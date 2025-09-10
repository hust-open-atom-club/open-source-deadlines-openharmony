/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import relationalStore from '@ohos.data.relationalStore';

import CommonConstants from './CommonConstants';
import Logger from './Logger';
import ReactDatabaseSupplier from './ReactDatabaseSupplier'

export default class AsyncLocalStorageUtil {

  static buildKeySelection(keys: string[], keyStart: number, keyCount: number) {
    let selectedKeys: string[] = [];
    for (let keyIndex = 0; keyIndex < keyCount; keyIndex++) {
      Logger.debug(CommonConstants.TAG, `buildKeySelection(), selectedKey: ${keys[keyStart + keyIndex]}`)
      selectedKeys.push(keys[keyStart + keyIndex]);
    }
    return selectedKeys;
  }

  static async getItemImpl(db: relationalStore.RdbStore, key: string): Promise<string | null> {
    let columns: string[] = new Array(ReactDatabaseSupplier.VALUE_COLUMN);
    let predicates = new relationalStore.RdbPredicates(ReactDatabaseSupplier.TABLE_CATALYST);
    predicates.equalTo(ReactDatabaseSupplier.KEY_COLUMN, key);
    let cursor = await db.query(predicates, columns);
    Logger.debug(CommonConstants.TAG, `getItemImpl(), ResultSet isAtFirstRow: ${cursor.isAtFirstRow}, row count: ${cursor.rowCount}`);
    try {
      if(!cursor.goToFirstRow()){
        return null;
      } else{
        return cursor.getString(cursor.getColumnIndex('VALUE'));
      }
    } catch (e) {
      Logger.error(CommonConstants.TAG, `getItemImpl() error: ${e.message}`)
      return null;
    } finally {
      cursor.close();
    }
  }

  /**  
   * Sets the value for the key given, returns true if successful, false otherwise.
   */
  static async setItemImpl(db: relationalStore.RdbStore, key: string, value:string): Promise<boolean> {
    Logger.debug(CommonConstants.TAG, `setItemImpl(), key: ${key}, newValue: ${value}`)
    let obj: relationalStore.ValuesBucket = {};
    obj.key = key;
    obj.value = value;
    try {
      db.beginTransaction();
      let inserted = await db.insert(ReactDatabaseSupplier.TABLE_CATALYST, obj, relationalStore.ConflictResolution.ON_CONFLICT_REPLACE);
      db.commit();
      return (-1 !== inserted);
    } catch (e) {
      Logger.error(CommonConstants.TAG, `setItemImpl() error: ${e.message}`)
    }
    return false;
  }

  /**
   *  Does the actual merge of the (key, value) pair with the value stored in the database.
   *  NB: This assumes that a database lock is already in effect!
   *  @return the errorCode of the operation
   */
  static async mergeImpl(db: relationalStore.RdbStore, key: string, value:string): Promise<boolean> {
    let oldValue = await AsyncLocalStorageUtil.getItemImpl(db, key);
    let newValue: string;

    try {
      if (oldValue == null) {
        newValue = value;
      } else {
        let oldJSON: Record<string, string | Object> = JSON.parse(oldValue);
        let newJSON: Record<string, string | Object> = JSON.parse(value);

        await AsyncLocalStorageUtil.deepMergeInto(oldJSON, newJSON);
        newValue = JSON.stringify(oldJSON);
      }
      let isSuccess = await AsyncLocalStorageUtil.setItemImpl(db, key, newValue);
      return isSuccess;
    } catch (e) {
      Logger.error(CommonConstants.TAG, `mergeImpl() error: ${e.message}`)
    }
    return false;
  }

  /**
   * Merges two {@link JSONObject}s. The newJSON object will be merged with the oldJSON object by
   * either overriding its values, or merging them (if the values of the same key in both objects
   * are of type {@link JSONObject}). oldJSON will contain the result of this merge.
   */
  private static async deepMergeInto(oldJSON: Record<string, string | Object>, newJSON: Record<string, string | Object>) {
    let keys: string[] = Object.keys(newJSON);
    for(let idx = 0; idx < keys.length; idx++) {
      let key = keys[idx];
      let newValue = JSON.stringify(newJSON[key]);
      let oldValue = JSON.stringify(oldJSON[key]);

      let newJSONObject = AsyncLocalStorageUtil.optJSONObject(newValue);
      let oldJSONObject = AsyncLocalStorageUtil.optJSONObject(oldValue);
      Logger.debug(CommonConstants.TAG, `deepMergeInto(), newJSONObject: ${JSON.stringify(newJSONObject)}, oldJSONObject: ${JSON.stringify(oldJSONObject)}`)

      if (newJSONObject !== null && oldJSONObject !== null) {
        await AsyncLocalStorageUtil.deepMergeInto(oldJSONObject, newJSONObject);
        oldJSON[key] = oldJSONObject;
      } else {
        oldJSON[key] = newJSON[key];
      }
    }
  }

  private static optJSONObject(value: string) {
    try {
      let JSONObject: Record<string, string | Object> = JSON.parse(value);
      if (typeof JSONObject == "object" && JSONObject && !Array.isArray(JSONObject)) {
        return JSONObject;
      }
    } catch (e) {
      Logger.error(CommonConstants.TAG, `optJSONObject() error: ${e.message}`)
    }
    return null;
  }
}
