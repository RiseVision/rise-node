// import { expect } from 'chai';
// import { Container } from 'inversify';
// import { Symbols } from '../../../src/ioc/symbols';
// import { VotesModel } from '../../../src/models';
// import { createContainer } from '../../utils/containerCreator';
//
// describe('VotesModel', () => {
//   let container: Container;
//   let instance: typeof VotesModel;
//   beforeEach(() => {
//     container = createContainer();
//     instance  = container.get(Symbols.models.votes);
//   });
//   describe('added and removed from constructor', () => {
//     it ('should properly fill added', () => {
//       let b = new instance({votes: '+aa'});
//       expect(b.added).deep.eq(['aa']);
//
//       b = new instance({votes: '+aa,+bb'});
//       expect(b.added).deep.eq(['aa', 'bb']);
//
//       b = new instance({votes: ''});
//       expect(b.added).deep.eq([]);
//
//       b = new instance({});
//       expect(b.added).deep.eq([]);
//     });
//
//     it('should properly fill removed', () => {
//       let b = new instance({votes: '-aa'});
//       expect(b.removed).deep.eq(['aa']);
//
//       b = new instance({votes: '-aa,-bb'});
//       expect(b.removed).deep.eq(['aa', 'bb']);
//
//       b = new instance({votes: ''});
//       expect(b.removed).deep.eq([]);
//
//       b = new instance({});
//       expect(b.removed).deep.eq([]);
//     });
//
//     it('should work with mixed votes', () => {
//       let b = new instance({votes: '+cc,-aa,+bb'});
//       expect(b.removed).deep.eq(['aa']);
//       expect(b.added).deep.eq(['cc', 'bb']);
//
//       b = new instance({votes: '-aa,+cc,-bb'});
//       expect(b.removed).deep.eq(['aa', 'bb']);
//       expect(b.added).deep.eq(['cc']);
//
//     });
//   });
// });