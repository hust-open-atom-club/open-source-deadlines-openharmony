/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

export default class AsyncLocker {

  ModifyRunning: Promise<Object> | null
  MultiGetRunning: Promise<[Object, [string,string][] | null]> | null
  GetAllKeysRunning: Promise<[Object, string[] | null]> | null

  constructor() {
    this.ModifyRunning = null;
    this.MultiGetRunning = null;
    this.GetAllKeysRunning = null;
  }
}