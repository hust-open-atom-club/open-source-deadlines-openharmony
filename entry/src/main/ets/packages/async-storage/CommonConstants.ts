/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import relationalStore from '@ohos.data.relationalStore';

export default class CommonConstants {
/** 
 * Rdb database config.
 */
static readonly STORE_CONFIG: relationalStore.StoreConfig = {
  name: 'RKStorage.db',
  securityLevel: relationalStore.SecurityLevel.S1
};
/** 
 * Log tag.
 */
static readonly TAG = '[RNOH] AsyncStorage';
}