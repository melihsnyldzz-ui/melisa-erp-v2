import { AsyncLocalStorage } from 'node:async_hooks';
const scope = new AsyncLocalStorage();
export const isTestSalesMutation = () => scope.getStore() === true;
export const withTestSalesMutation = operation => scope.run(true, operation);
