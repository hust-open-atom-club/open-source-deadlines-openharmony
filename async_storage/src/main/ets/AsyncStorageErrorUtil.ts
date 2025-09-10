/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

export default class AsyncStorageErrorUtil {

  static getError(key: string | null, errorMessage: string) {
    let errorMap: Record<string, string> = {};
    errorMap["message"] = errorMessage;
    if (key !== null) {
      errorMap["key"] = key;
    }
    return errorMap;
  }

  static getInvalidKeyError(key: string | null): Record<string, string> {
    return AsyncStorageErrorUtil.getError(key, "Invalid key");
  }

  static getInvalidValueError(key: string | null): Record<string, string> {
    return AsyncStorageErrorUtil.getError(key, "Invalid Value");
  }

  static getDBError(key: string | null): Record<string, string> {
    return AsyncStorageErrorUtil.getError(key, "Database Error");
  }  
}