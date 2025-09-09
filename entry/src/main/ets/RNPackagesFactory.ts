import {RNPackage, RNPackageContext} from '@rnoh/react-native-openharmony/ts';
import { AsyncStoragePackage } from './packages/async-storage/AsyncStoragePackage';

export function createRNPackages(ctx: RNPackageContext): RNPackage[] {
  return [
    new AsyncStoragePackage(ctx)
  ];
}