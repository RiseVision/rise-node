// import { expect } from 'chai';
// import { Container } from 'inversify';
// import { Symbols } from '../../../src/ioc/symbols';
// import { MultiSignaturesModel, VotesModel } from '../../../src/models';
// import { createContainer } from '../../utils/containerCreator';
//
// describe('MultisignaturesModel', () => {
//   let container: Container;
//   let instance: typeof MultiSignaturesModel;
//   beforeEach(() => {
//     container = createContainer();
//     instance  = container.get(Symbols.models.multisignatures);
//   });
//   describe('added and removed from constructor', () => {
//     it ('should properly fill added', () => {
//       let b = new instance({keysgroup: '+aa'});
//       expect(b.added).deep.eq(['aa']);
//
//       b = new instance({keysgroup: '+aa,+bb'});
//       expect(b.added).deep.eq(['aa', 'bb']);
//
//       b = new instance({keysgroup: ''});
//       expect(b.added).deep.eq([]);
//
//       b = new instance({});
//       expect(b.added).deep.eq([]);
//     });
//
//     it('should properly fill removed', () => {
//       let b = new instance({keysgroup: '-aa'});
//       expect(b.removed).deep.eq(['aa']);
//
//       b = new instance({keysgroup: '-aa,-bb'});
//       expect(b.removed).deep.eq(['aa', 'bb']);
//
//       b = new instance({keysgroup: ''});
//       expect(b.removed).deep.eq([]);
//
//       b = new instance({});
//       expect(b.removed).deep.eq([]);
//     });
//
//     it('should work with mixed keysgroup', () => {
//       let b = new instance({keysgroup: '+cc,-aa,+bb'});
//       expect(b.removed).deep.eq(['aa']);
//       expect(b.added).deep.eq(['cc', 'bb']);
//
//       b = new instance({keysgroup: '-aa,+cc,-bb'});
//       expect(b.removed).deep.eq(['aa', 'bb']);
//       expect(b.added).deep.eq(['cc']);
//
//     });
//   });
// });
