import { Column, DefaultScope, PrimaryKey, Scopes, Table } from 'sequelize-typescript';
import { expect } from 'chai';
import { mergeModels } from '../../src/helpers/utils';
import { BaseModel } from '../../src/models';
import { createNewTestSequelize } from '../utils/createNewTestSequelize';

describe('helpers/mergeModels', () => {
  it('should merge attributes', () => {
    @Table({ modelName: 'hey_brotha' })
    class A extends BaseModel<A> {
      @Column
      private a: string;
    }

    @Table({ modelName: 'hey_brotha' })
    class B extends BaseModel<B> {
      @PrimaryKey
      @Column
      private b: string;
    }

    mergeModels(B, A);

    const s = createNewTestSequelize();

    s.addModels([A]);
    expect(A.attributes.a).not.undefined;
    expect(A.attributes.b).not.undefined;
    expect(A.attributes.b.primaryKey).true;
  });
  it('should merge scopes', () => {
    @Scopes({
      both     : { attributes: ['a'] },
      only_in_a: { attributes: ['a'] },
    })
    @DefaultScope({
      attributes: ['a', 'b'],
    })
    @Table({ modelName: 'a' })
    class A extends BaseModel<A> {
      @Column
      private a: string;
      @Column
      private b: string;
    }

    @Scopes({
      both     : { attributes: ['b'], },
      only_in_b: { attributes: ['b'] },
    })
    @DefaultScope({
      attributes: ['c'],
    })
    @Table({ modelName: 'a' })
    class B extends BaseModel<B> {
      @Column
      private c: number;
    }

    mergeModels(B, A);

    const s = createNewTestSequelize();

    s.addModels([A]);

    expect(A.options.scopes).to.haveOwnProperty('both');
    expect(A.options.scopes).to.haveOwnProperty('only_in_a');
    expect(A.options.scopes).to.haveOwnProperty('only_in_b');

    expect(A.options.scopes.both).deep.eq({ attributes: ['a', 'b'] }); // merged;
    expect(A.options.scopes.only_in_a).deep.eq({ attributes: ['a'] });
    expect(A.options.scopes.only_in_b).deep.eq({ attributes: ['b'] });
    expect(A.options.defaultScope).deep.eq({ attributes: ['a', 'b', 'c'] });

  });

  it('should merge methods', () => {

    @Table({ modelName: 'a' })
    class A extends BaseModel<A> {
      @Column
      private a: string;
      @Column
      private b: string;

      public methodInA() {
        return 'a';
      }
      public methodInBoth() {
        return 'both-a';
      }
    }

    @Table({ modelName: 'a' })
    class B extends BaseModel<B> {
      @Column
      private c: number;

      public methodInB() {
        return 'b';
      }

      public methodInBoth() {
        return 'both-b';
      }
    }

    mergeModels(B, A);

    const s = createNewTestSequelize();
    s.addModels([A]);

    const a = new A();

    expect(a.methodInA()).eq('a');
    expect(a.methodInBoth()).eq('both-b');
    expect(a['methodInB']()).eq('b');
  });
});
