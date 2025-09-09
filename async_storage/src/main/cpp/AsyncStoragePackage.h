/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

#include "RNOH/Package.h"
#include "RNCAsyncStorage.h"

using namespace rnoh;
using namespace facebook;
class NativeRNAsyncStorageFactoryDelegate : public TurboModuleFactoryDelegate {
  public:
    SharedTurboModule createTurboModule(Context ctx,const std::string &name) const override {
      if (name == "RNCAsyncStorage") {
          return std::make_shared<RNCAsyncStorage>(ctx, name);
      }
      return nullptr;
    };
};

namespace rnoh {
class AsyncStoragePackage : public Package {
  public:
    AsyncStoragePackage(Package::Context ctx) : Package(ctx) {}
    std::unique_ptr<TurboModuleFactoryDelegate> createTurboModuleFactoryDelegate() override {
        return std::make_unique<NativeRNAsyncStorageFactoryDelegate>();
    }
};
} // namespace rnoh
