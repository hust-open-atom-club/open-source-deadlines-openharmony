/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import { RNPackage, AnyThreadTurboModuleFactory } from '@rnoh/react-native-openharmony/ts';
import type { AnyThreadTurboModule, AnyThreadTurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { AsyncStorageTurboModule } from './AsyncStorageTurboModule';

class AsyncStorageTurboModulesFactory extends AnyThreadTurboModuleFactory {

  createTurboModule(name: string): AnyThreadTurboModule | null {
    if (name === 'RNCAsyncStorage') {
      return new AsyncStorageTurboModule(this.ctx);
    }
    return null;
  }

  hasTurboModule(name: string): boolean {
    return name === 'RNCAsyncStorage';
  }
}

export class AsyncStoragePackage extends RNPackage {
  createAnyThreadTurboModuleFactory(ctx: AnyThreadTurboModuleContext): AnyThreadTurboModuleFactory {
    return new AsyncStorageTurboModulesFactory(ctx);
  }
}