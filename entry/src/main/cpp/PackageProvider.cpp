#include "RNOH/PackageProvider.h"  
#include "AsyncStoragePackage.h" 

using namespace rnoh;  
std::vector<std::shared_ptr<Package>> 
PackageProvider::getPackages(Package::Context ctx) {
   return {
        std::make_shared<AsyncStoragePackage>(ctx)
   };
}