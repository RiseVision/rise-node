import { expect } from 'chai';
import {
  InMemoryFilterModel,
  WordPressHookSystem,
  WPHooksSubscriber,
} from 'mangiafuoco';
import {
  createActionDecorator,
  createFilterDecorator,
} from '../../../src/decorators';

describe('decorators/hookDecoratorCreator', () => {
  const wphook = new WordPressHookSystem(new InMemoryFilterModel());
  const wphook2 = new WordPressHookSystem(new InMemoryFilterModel());
  const fa = createFilterDecorator<any>('a');
  const fb = createFilterDecorator<any>('b');
  const aa = createActionDecorator<any>('a');
  const ab = createActionDecorator<any>('b');
  // tslint:disable-next-line class-name
  class x extends WPHooksSubscriber(Object) {
    public hookSystem = wphook;
    public calls: Array<{ name: string; args: any[] }> = [];

    @fa(() => wphook)
    public async one(...args) {
      return this.calls.push({ name: 'one', args });
    }

    @fb(() => wphook)
    public async two(...args) {
      return this.calls.push({ name: 'two', args });
    }

    @fa()
    public async three(...args) {
      return this.calls.push({ name: 'three', args });
    }

    @fa(9)
    public async four(...args) {
      return this.calls.push({ name: 'four', args });
    }

    @fa(() => wphook, 11)
    public async five(...args) {
      return this.calls.push({ name: 'five', args });
    }

    @aa(() => wphook)
    public async actionone(...args) {
      return this.calls.push({ name: 'actionone', args });
    }

    @ab(() => wphook)
    public async actiontwo(...args) {
      return this.calls.push({ name: 'actiontwo', args });
    }

    @aa()
    public async actionthree(...args) {
      return this.calls.push({ name: 'actionthree', args });
    }

    @aa(9)
    public async actionfour(...args) {
      return this.calls.push({ name: 'actionfour', args });
    }

    @aa(() => wphook, 11)
    public async actionfive(...args) {
      return this.calls.push({ name: 'actionfive', args });
    }

    @fa(() => wphook2)
    public async another(...args) {
      return this.calls.push({ name: 'another', args });
    }

    @aa(() => wphook2)
    public async anotherAction(...args) {
      return this.calls.push({ name: 'anotherAction', args });
    }

    @fa()
    @fa(11)
    @fa(() => wphook, 12)
    @aa()
    @aa(11)
    @aa(() => wphook, 12)
    public async all(...args) {
      return this.calls.push({ name: 'all', args });
    }
  }

  let instance: x;
  beforeEach(async () => {
    instance = new x();
    await instance.hookMethods();
  });
  afterEach(async () => {
    await instance.unHook();
  });

  it('should not call any stub if wphook2', async () => {
    await wphook2.do_action('a');
    expect(instance.calls).deep.eq([
      {
        args: [undefined],
        name: 'anotherAction',
      },
    ]);
  });

  it('should call action in order with proper args', async () => {
    await wphook.do_action('a', 'meow');
    expect(instance.calls).deep.eq([
      { name: 'actionfour', args: ['meow'] },
      { name: 'actionone', args: ['meow'] },
      { name: 'actionthree', args: ['meow'] },
      { name: 'all', args: ['meow'] },
      { name: 'actionfive', args: ['meow'] },
      { name: 'all', args: ['meow'] },
      { name: 'all', args: ['meow'] },
    ]);
  });

  it('should call filter in order with proper args', async () => {
    await wphook.apply_filters('a', 'meow');
    expect(instance.calls).deep.eq([
      { name: 'four', args: ['meow'] },
      { name: 'one', args: [1] },
      { name: 'three', args: [2] },
      { name: 'all', args: [3] },
      { name: 'five', args: [4] },
      { name: 'all', args: [5] },
      { name: 'all', args: [6] },
    ]);
  });
});
