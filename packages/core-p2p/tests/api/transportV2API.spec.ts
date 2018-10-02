import 'reflect-metadata';
import { Container, injectable, multiInject, named } from 'inversify';

@injectable()
class A {

  @multiInject('a')
  @named('a')
  public bit: Array<string>;
}



describe('api/transport', () => {
  it('bit', () => {
    const container = new Container();
    container.bind('a').toConstantValue('a').whenTargetNamed('a');
    container.bind('a').toConstantValue('b').whenTargetNamed('b');
    container.bind('a').toConstantValue('c').whenTargetNamed('c');
    container.bind('a').toConstantValue('d').whenTargetNamed('d');

    container.bind('main').to(A).inSingletonScope();
console.log(container.getAll('a'));
    const main = container.get<A>('main');

    console.log(main.bit);
  })
});
