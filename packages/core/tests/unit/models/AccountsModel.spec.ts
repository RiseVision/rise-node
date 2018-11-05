// import { createContainer } from '../../utils/containerCreator';
// import { Container } from 'inversify';
// import { Symbols } from '../../../src/ioc/symbols';
// import { AccountsModel } from '../../../src/models';
// import { expect } from 'chai';
//
// describe('AccountsModel', () => {
//   let container: Container;
//   let instance: typeof AccountsModel;
//   beforeEach(() => {
//     container = createContainer();
//     instance  = container.get(Symbols.models.accounts);
//   });
//   describe('createBulkAccountsSQL', () => {
//     it('should return correct sql for 1 address', () => {
//       const res = instance.createBulkAccountsSQL(['1R']);
//       expect(res).to.be.deep.eq(`
//     INSERT into mem_accounts(address)
//     SELECT address from (VALUES ('1R') ) i (address)
//     LEFT JOIN mem_accounts m1 USING(address)
//     WHERE m1.address IS NULL`);
//     });
//     it('should behave correctly for 2 addresses', () => {
//       const res = instance.createBulkAccountsSQL(['1R', '2R']);
//       expect(res).to.be.deep.eq(`
//     INSERT into mem_accounts(address)
//     SELECT address from (VALUES ('1R'), ('2R') ) i (address)
//     LEFT JOIN mem_accounts m1 USING(address)
//     WHERE m1.address IS NULL`);
//     });
//     it('should behave correctly with sql injection', () => {
//       const res = instance.createBulkAccountsSQL(['1R\' OR \'1=1']);
//       expect(res).to.be.deep.eq(`
//     INSERT into mem_accounts(address)
//     SELECT address from (VALUES ('1R'' OR ''1=1') ) i (address)
//     LEFT JOIN mem_accounts m1 USING(address)
//     WHERE m1.address IS NULL`);
//     });
//     it('should return empty string for no addreses', () => {
//       const res = instance.createBulkAccountsSQL([]);
//       expect(res).to.be.deep.eq('');
//     });
//     it('should returm empty if non empty array but undefined or null address', () => {
//       const res = instance.createBulkAccountsSQL([null, undefined]);
//       expect(res).to.be.deep.eq('');
//     });
//   });
// });
