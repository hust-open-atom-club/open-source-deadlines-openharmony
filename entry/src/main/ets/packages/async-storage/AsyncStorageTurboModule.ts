/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import relationalStore from '@ohos.data.relationalStore';
import { AnyThreadTurboModule, AnyThreadTurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import ReactDatabaseSupplier from './ReactDatabaseSupplier';
import AsyncStorageErrorUtil from './AsyncStorageErrorUtil';
import Logger from './Logger';
import CommonConstants from './CommonConstants'
import AsyncLocalStorageUtil from './AsyncLocalStorageUtil';
import AsyncLocker from './AsyncLocker'

const MAX_SQL_KEYS = 999;

export class AsyncStorageTurboModule extends AnyThreadTurboModule {

  private table = new ReactDatabaseSupplier()
  private lock: AsyncLocker = new AsyncLocker()

  constructor(ctx: AnyThreadTurboModuleContext) {
    super(ctx);
    Logger.debug(CommonConstants.TAG, `AsyncStorageTurboModule construct!`);
    this.table.initialRdbStore(this.ctx.uiAbilityContext);
  }

  /** 
   * Given an array of keys, this returns a map of (key, value) pairs for the keys found, and
   * (key, null) for the keys that haven't been found.
   */
  multiGet(keys: string[], callback: (error?: Object, result?: [string, string][] | null) => void) {
    Logger.debug(CommonConstants.TAG, `Module multiGet() Call!`);
    this.runMultiGet(keys).then((result) => { callback(result[0], result[1]) }).catch((e: Error) => {
      Logger.debug(CommonConstants.TAG, `Module multiGet() Call Fail!${e.message}`);
    })
    Logger.debug(CommonConstants.TAG, `Module multiGet() End!`);
  }

  async runMultiGet(keys: string[]): Promise<[Object, [string, string][] | null]> {
    if (this.lock.MultiGetRunning) {
      await this.lock.MultiGetRunning;
    }
    if (this.lock.ModifyRunning) {
      await this.lock.ModifyRunning;
    }
    if (this.lock.GetAllKeysRunning) {
      await this.lock.GetAllKeysRunning;
    }
    this.lock.MultiGetRunning = this.asyncMultiGet(keys);
    let result = await this.lock.MultiGetRunning;
    this.lock.MultiGetRunning = null;
    Logger.debug(CommonConstants.TAG, `asyncMultiGet execute done: ${result[0] ? JSON.stringify(result[0]) : "success"}`)
    return result;
  }

  async asyncMultiGet(keys: string[]): Promise<[Object, [string, string][] | null]> {
    Logger.debug(CommonConstants.TAG, `ModuleSub asyncMultiGet() Call!`);
    if (keys === null) {
      return [AsyncStorageErrorUtil.getInvalidKeyError(null), null];
    }
    if (!await this.table.ensureDatabase(this.ctx.uiAbilityContext)) {
      return [AsyncStorageErrorUtil.getDBError(null), null];
    }
    let columns: string[] = [ReactDatabaseSupplier.KEY_COLUMN, ReactDatabaseSupplier.VALUE_COLUMN];
    let keysRemaining: Set<string> = new Set();
    let data: [string, string][] = [];
    for (let keyStart = 0; keyStart < keys.length; keyStart += MAX_SQL_KEYS) {
      let keyCount = Math.min(keys.length - keyStart, MAX_SQL_KEYS);
      let predicates = new relationalStore.RdbPredicates(ReactDatabaseSupplier.TABLE_CATALYST);
      Logger.debug(CommonConstants.TAG, `keys: ${keys}, keyStart: ${keyStart}, keyCount: ${keyCount}`)
      predicates.in("KEY", AsyncLocalStorageUtil.buildKeySelection(keys, keyStart, keyCount));
      keysRemaining.clear();
      let cursor = await this.table.rdbStore.query(predicates, columns);
      try {
        Logger.debug(CommonConstants.TAG, `ResultSet isAtFirstRow: ${cursor.isAtFirstRow}, row count: ${cursor.rowCount}`);
        if (cursor.rowCount !== keys.length) {
          for (let keyIndex = keyStart; keyIndex < keyStart + keyCount; keyIndex++) {
            keysRemaining.add(keys[keyIndex]);
          }
        }
        if (cursor.goToFirstRow()) {
          do {
            let row: [string, string] = ['', ''];
            row[0] = cursor.getString(cursor.getColumnIndex('KEY'));
            row[1] = cursor.getString(cursor.getColumnIndex('VALUE'));
            data.push(row);
            keysRemaining.delete(cursor.getString(cursor.getColumnIndex('KEY')));
          } while (cursor.goToNextRow());
        }
      } catch (e) {
        Logger.warn(CommonConstants.TAG, e.message);
        [AsyncStorageErrorUtil.getError(null, e.message), null];
      } finally {
        cursor.close();
      }
      for (let key of keysRemaining) {
        let row: [string, string] = ['', ''];
        row[0] = key;
        data.push(row);
      }
      keysRemaining.clear();
    }
    return [null, data];
  }

  /** 
   * Inserts multiple (key, value) pairs. If one or more of the pairs cannot be inserted, this will
   * return AsyncLocalStorageFailure, but all other pairs will have been inserted.
   * The insertion will replace conflicting (key, value) pairs.
   */
  multiSet(keyValueArray: [string, string][], callback: (error?: Object) => void) {
    Logger.debug(CommonConstants.TAG, `Module multiSet() Call!`);
    this.runMultiSet(keyValueArray).then((error) => { callback(error) }).catch((e: Error) => {
      Logger.debug(CommonConstants.TAG, `Module multiSet() Call Fail!${e.message}`);
    })
    Logger.debug(CommonConstants.TAG, `Module multiSet() End!`);
  }

  async runMultiSet(keyValueArray: [string, string][], hasError = false): Promise<Object> {
    if (this.lock.GetAllKeysRunning) {
      await this.lock.GetAllKeysRunning;
    }
    if (this.lock.MultiGetRunning) {
      await this.lock.MultiGetRunning;
    }
    if (this.lock.ModifyRunning) {
      await this.lock.ModifyRunning;
    }
    this.lock.ModifyRunning = this.asyncMultiSet(keyValueArray);
    let result = await this.lock.ModifyRunning;
    this.lock.ModifyRunning = null;
    if (hasError) result = AsyncStorageErrorUtil.getInvalidKeyError(null);
    Logger.debug(CommonConstants.TAG, `asyncMultiSet execute done: ${result ? JSON.stringify(result) : "success"}`)
    return result;
  }

  async asyncMultiSet(keyValueArray: [string, string][]): Promise<Object> {
    Logger.debug(CommonConstants.TAG, `ModuleSub asyncMultiSet() Call!`);
    if (keyValueArray.length === 0) {
      return null;
    }
    if (!await this.table.ensureDatabase(this.ctx.uiAbilityContext)) {
      return AsyncStorageErrorUtil.getDBError(null);
    }
    let error: Object | null = null;
    try {
      this.table.rdbStore.beginTransaction();
      for (let idx = 0; idx < keyValueArray.length; idx++) {
        if (keyValueArray[idx].length !== 2) {
          error = AsyncStorageErrorUtil.getInvalidValueError(null);
          return;
        }
        if (keyValueArray[idx][0] === null) {
          error = AsyncStorageErrorUtil.getInvalidKeyError(null);
          return;
        }
        if (keyValueArray[idx][1] === null) {
          error = AsyncStorageErrorUtil.getInvalidValueError(null);
          return;
        }
        let obj: relationalStore.ValuesBucket = {};
        obj.key = keyValueArray[idx][0];
        obj.value = keyValueArray[idx][1];
        await this.table.rdbStore.insert(ReactDatabaseSupplier.TABLE_CATALYST, obj, relationalStore.ConflictResolution.ON_CONFLICT_REPLACE)
        this.table.rdbStore.commit();
        Logger.debug(CommonConstants.TAG, `key: ${obj.key}, value: ${obj.value}, Insert success!`)
      }
    } catch (e) {
      let e_message = `Insert is failed, code is ${e.code},message is ${e.message}`
      Logger.warn(CommonConstants.TAG, e_message)
      error = AsyncStorageErrorUtil.getError(null, e_message)
    } finally {
      try {

      } catch (e) {
        Logger.warn(CommonConstants.TAG, e.message)
        if (error !== null) {
          error = AsyncStorageErrorUtil.getError(null, e.message);
        }
      }
    }
    if(error !== null) {
      return error;
    } else {
      return null;
    }
  }

  /** 
   * Removes all rows of the keys given.
   */
  multiRemove(keys: string[], callback: (error?:Object) => void) {
    Logger.debug(CommonConstants.TAG, `Module multiRemove() Call!`);
    this.runMultiRemove(keys).then((error)=>{callback(error)}).catch((e:Error)=>{
      Logger.debug(CommonConstants.TAG, `Module multiRemove() Call Fail!${e.message}`);
    })
    Logger.debug(CommonConstants.TAG, `Module multiRemove() End!`);
  }

  async runMultiRemove(keys: string[]): Promise<Object> {
    if (this.lock.GetAllKeysRunning) {
      await this.lock.GetAllKeysRunning;
    }
    if (this.lock.MultiGetRunning) {
      await this.lock.MultiGetRunning;
    }
    if (this.lock.ModifyRunning) {
      await this.lock.ModifyRunning;
    }
    this.lock.ModifyRunning = this.asyncMultiRemove(keys);
    let result = await this.lock.ModifyRunning;
    this.lock.ModifyRunning = null;
    Logger.debug(CommonConstants.TAG, `asyncMultiRemove execute done: ${result ? JSON.stringify(result) : "success"}`)
    return result;
  }

  async asyncMultiRemove(keys: string[]): Promise<Object> {
    Logger.debug(CommonConstants.TAG, `ModuleSub asyncMultiRemove() Call!`);
    if(keys.length === 0) {
      return null;
    }
    if (!await this.table.ensureDatabase(this.ctx.uiAbilityContext)) {
      return AsyncStorageErrorUtil.getDBError(null);
    }
    let error: Object | null = null;
    try {
      this.table.rdbStore.beginTransaction();
      for (let keyStart = 0; keyStart < keys.length; keyStart += MAX_SQL_KEYS) {
        let keyCount = Math.min(keys.length - keyStart, MAX_SQL_KEYS);
        let predicates = new relationalStore.RdbPredicates(ReactDatabaseSupplier.TABLE_CATALYST);
        predicates.in("KEY", AsyncLocalStorageUtil.buildKeySelection(keys, keyStart, keyCount));
        await this.table.rdbStore.delete(predicates);
        this.table.rdbStore.commit();
        Logger.debug(CommonConstants.TAG, `keys: ${keys}, Delete success!`)
      }
    } catch (e) {
      Logger.warn(CommonConstants.TAG, e.message);
      error = AsyncStorageErrorUtil.getError(null, e.message);
    }
    if (error != null) {
      return error
    } else {
      return null;
    }
  }

  /** 
   * Given an array of (key, value) pairs, this will merge the given values with the stored values
   * of the given keys, if they exist.
   */
  multiMerge(keyValueArray: [string, string][], callback: (error?: Object) => void) {
    Logger.debug(CommonConstants.TAG, `Module multiMerge() Call!`);
    this.runMultiMerge(keyValueArray).then((error)=>{callback(error)}).catch((e:Error)=>{
      Logger.debug(CommonConstants.TAG, `Module multiMerge() Call Fail!${e.message}`);
    })
    Logger.debug(CommonConstants.TAG, `Module multiMerge() End!`);
  }

  async runMultiMerge(keyValueArray: [string, string][]): Promise<Object> {
    if (this.lock.GetAllKeysRunning) {
      await this.lock.GetAllKeysRunning;
    }
    if (this.lock.MultiGetRunning) {
      await this.lock.MultiGetRunning;
    }
    if (this.lock.ModifyRunning) {
      await this.lock.ModifyRunning;
    }
    this.lock.ModifyRunning = this.asyncMultiMerge(keyValueArray);
    let result = await this.lock.ModifyRunning;
    this.lock.ModifyRunning = null;
    Logger.debug(CommonConstants.TAG, `asyncMultiMerge execute done: ${result ? JSON.stringify(result) : "success"}`)
    return result;
  }

  async asyncMultiMerge(keyValueArray: [string, string][]): Promise<Object> {
    Logger.debug(CommonConstants.TAG, `ModuleSub asyncMultiMerge() Call!`);
    if (!await this.table.ensureDatabase(this.ctx.uiAbilityContext)) {
      return AsyncStorageErrorUtil.getDBError(null);
    }
    let error: Object | null = null;
    try {
      for (let idx = 0; idx < keyValueArray.length; idx++) {
        if (keyValueArray[idx].length !== 2) {
          error = AsyncStorageErrorUtil.getInvalidValueError(null)
          return error;
        }
        if (keyValueArray[idx][0] === null) {
          error = AsyncStorageErrorUtil.getInvalidKeyError(null)
          return error;
        }
        if (keyValueArray[idx][1] === null) {
          error = AsyncStorageErrorUtil.getInvalidValueError(null)
          return error;
        }
        if(!await AsyncLocalStorageUtil.mergeImpl(this.table.rdbStore, keyValueArray[idx][0], keyValueArray[idx][1])){
          error = AsyncStorageErrorUtil.getDBError(null)
          return error;
        }
      }
    } catch (e) {
      Logger.warn(CommonConstants.TAG, e.message);
      error = AsyncStorageErrorUtil.getError(null, e.message);
    } 
    if(error != null) {
      return error;
    } else {
      return null;
    }
  }

  /** 
   * Clears the database.
   */
  clear(callback: (error?: Object) => void) {
    Logger.debug(CommonConstants.TAG, `Module clear() Call!`);
    this.runClear().then((error)=>{callback(error)}).catch((e:Error)=>{
      Logger.debug(CommonConstants.TAG, `Module clear() Call Fail!${e.message}`);
    })
    Logger.debug(CommonConstants.TAG, `Module clear() End!`);
  }

  async runClear(): Promise<Object> {
    if (this.lock.GetAllKeysRunning) {
      await this.lock.GetAllKeysRunning;
    }
    if (this.lock.MultiGetRunning) {
      await this.lock.MultiGetRunning;
    }
    if (this.lock.ModifyRunning) {
      await this.lock.ModifyRunning;
    }
    this.lock.ModifyRunning = this.asyncClear();
    let result = await this.lock.ModifyRunning;
    this.lock.ModifyRunning = null;
    Logger.debug(CommonConstants.TAG, `asyncClear execute done: ${result ? JSON.stringify(result) : "success"}`)
    return result;
  }

  async asyncClear(): Promise<Object> {
    Logger.debug(CommonConstants.TAG, `ModuleSub asyncClear() Call!`);
    if (!await this.table.ensureDatabase(this.ctx.uiAbilityContext)) {
      return AsyncStorageErrorUtil.getDBError(null);
    }
    try {
      await this.table.deleteRdbStore(this.ctx.uiAbilityContext);
    } catch (e) {
      Logger.warn(CommonConstants.TAG, `Module clear() error: ${e.message}`);
      return AsyncStorageErrorUtil.getError(null, e.message)
    }
    return null;
  }

  /** 
   * Returns an array with all keys from the database.
   */
  getAllKeys(callback: (error?: Object, result?: string[] | null) => void) {
    Logger.debug(CommonConstants.TAG, `Module getAllKeys() Call!`);
    this.runGetAllKeys().then((result)=>{callback(result[0], result[1])}).catch((e:Error)=>{
      Logger.debug(CommonConstants.TAG, `Module getAllKeys() Call Fail!${e.message}`);
    })
    Logger.debug(CommonConstants.TAG, `Module getAllKeys() End!`);
  }

  async runGetAllKeys(): Promise<[Object, string[] | null]> {
    if (this.lock.MultiGetRunning) {
      await this.lock.MultiGetRunning;
    }
    if (this.lock.ModifyRunning) {
      await this.lock.ModifyRunning;
    }
    if (this.lock.GetAllKeysRunning) {
      await this.lock.GetAllKeysRunning;
    }
    this.lock.GetAllKeysRunning = this.asyncGetAllKeys();
    let result = await this.lock.GetAllKeysRunning;
    this.lock.GetAllKeysRunning = null;
    Logger.debug(CommonConstants.TAG, `asyncGetAllKeys execute done: ${result[0] ? JSON.stringify(result[0]) : "success"}`)
    return result;
  }

  async asyncGetAllKeys(): Promise<[Object, string[] | null]> {
    Logger.debug(CommonConstants.TAG, `ModuleSub asyncGetAllKeys() Call!`);
    if (!await this.table.ensureDatabase(this.ctx.uiAbilityContext)) {
      return [AsyncStorageErrorUtil.getDBError(null), null];
    }
    let data: string[] = [];
    let predicates = new relationalStore.RdbPredicates(ReactDatabaseSupplier.TABLE_CATALYST);
    predicates.isNotNull(ReactDatabaseSupplier.KEY_COLUMN);
    let cursor = await this.table.rdbStore.query(predicates);
    try {
      if(cursor.goToFirstRow()){
        do {
          data.push(cursor.getString(cursor.getColumnIndex('KEY')));
        } while (cursor.goToNextRow())
      }
    } catch (e) {
      Logger.warn(CommonConstants.TAG, `Module GetAllKeys() error: ${e.message}`);
      return [AsyncStorageErrorUtil.getError(null, e.message),null];
    } finally {
      cursor.close();
    }
    return [null, data]
  }
}