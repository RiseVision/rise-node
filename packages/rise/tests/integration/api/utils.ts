import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import * as url from 'url';
import { Symbols } from '../../../src/ioc/symbols';
import { ProtoBufHelper } from '../../../src/helpers';

export const checkAddress = (paramName: string, baseUrl: string) => {
  it(`should throw if ${paramName} is not a valid address`, async () => {
    return supertest(initializer.appManager.expressApp)
      .get(`${baseUrl}?${paramName}=1`)
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`${paramName} - Object didn't pass validation for format address`);
      });
  });
};
export const checkPubKey = (paramName: string, baseUrl: string) => {
  it(`should throw if ${paramName} is not a valid publicKey`, async () => {
    return supertest(initializer.appManager.expressApp)
      .get(`${baseUrl}?${paramName}=1`)
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`${paramName} - Object didn't pass validation for format publicKey`);
      });
  });
};

export const checkPostPubKey = (paramName: string, baseUrl: string, body: any) => {
  it(`should throw if ${paramName} is not a valid publicKey`, async () => {
    body[paramName] = '1';
    return supertest(initializer.appManager.expressApp)
      .post(`${baseUrl}`)
      .send(body)
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`${paramName} - Object didn't pass validation for format publicKey`);
      });
  });
};
export const checkReturnObjKeyVal = (objKey: string, expectedValue: any, path: string, headers: any = {}, proto?: {namespace: string, message?: string}) => {
  it(`should return .${objKey} with ${expectedValue}`, async () => {
    return supertest(initializer.appManager.expressApp)
      .get(path)
      .set(headers)
      .expect(200)
      .then((response) => {
        let obj = response.body;
        if (Buffer.isBuffer(response.body)) {
          if (!proto) {
            throw new Error('Response seems to be protobuf but no proto file provided');
          }
          const protobufHelper = initializer.appManager.container.get<ProtoBufHelper>(Symbols.helpers.protoBuf);
          obj = protobufHelper.decode(response.body, proto.namespace, proto.message);
        } else {
          if (objKey !== 'success') {
            expect(response.body.success).is.true;
          }
        }
        expect(obj).to.haveOwnProperty(objKey);
        expect(obj[objKey]).to.be.deep.eq(expectedValue);
      });
  });
};
export const checkEnumParam = (paramName: string, allowedValues: string[], validUrl: string) => {
  for (const value of allowedValues) {
    it(`should allow ${paramName} to be ${value}`, async () => {
      const theURLOBJ = url.parse(validUrl, true);
      delete theURLOBJ.query[paramName];
      delete theURLOBJ.search;
      delete theURLOBJ.path;
      delete theURLOBJ.href;
      theURLOBJ.query[paramName] = value;
      return supertest(initializer.appManager.expressApp)
        .get(url.format(theURLOBJ))
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
        });
    });
  }

  it(`should disallow anything not included in allowed params for ${paramName}`, async () => {
    const theURLOBJ = url.parse(validUrl, true);
    delete theURLOBJ.query[paramName];
    delete theURLOBJ.search;
    delete theURLOBJ.path;
    delete theURLOBJ.href;
    theURLOBJ.query[paramName] = 'ahahahaha';
    return supertest(initializer.appManager.expressApp)
      .get(url.format(theURLOBJ))
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
      });
  });
}
export const checkRequiredParam = (paramName: string, validUrl: string) => {
  it(`should throw if ${paramName} is not provided`, async () => {
    const theURLOBJ = url.parse(validUrl, true);
    delete theURLOBJ.query[paramName];
    delete theURLOBJ.search;
    delete theURLOBJ.path;
    delete theURLOBJ.href;
    return supertest(initializer.appManager.expressApp)
      .get(url.format(theURLOBJ))
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`Missing required property: ${paramName}`);
      });
  });
}

export const checkPostRequiredParam = (paramName: string, validUrl: string, body: any) => {
  it(`should throw if ${paramName} is not provided`, async () => {
    const theURLOBJ = url.parse(validUrl, true);
    delete theURLOBJ.query[paramName];
    delete theURLOBJ.search;
    delete theURLOBJ.path;
    delete theURLOBJ.href;
    return supertest(initializer.appManager.expressApp)
      .post(url.format(theURLOBJ))
      .send(body)
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`Missing required property: ${paramName}`);
      });
  });
}
//
// export const checkString = (paramName: string, baseUrl: string, constraints: {min?: number, max?: number }, validString: string) => {
//   if (typeof(constraints.min) !== 'undefined') {
//     it(`should throw if ${paramName} is a string long ${constraints.min} is given`, async () => {
//       return supertest(initializer.appManager.expressApp)
//         .get(`${baseUrl}?${paramName}=${validString.substr(0, constraints.min)}`)
//         .expect(500)
//         .then((response) => {
//           expect(response.body.success).is.false;
//           expect(response.body.error).to.contain(`${paramName} - Object didn't pass validation for format publicKey`);
//         });
//     });
//   }
//
// }

export const checkIntParam = (paramName: string, validURL: string, constraints: { min?: number, max?: string | number } = {}) => {
  it(`should throw if ${paramName} is given as string`, async () => {
    const theURLOBJ = url.parse(validURL, true);
    delete theURLOBJ.query[paramName];
    delete theURLOBJ.search;
    delete theURLOBJ.path;
    delete theURLOBJ.href;
    theURLOBJ.query[paramName] = 'ahah';
    return supertest(initializer.appManager.expressApp)
      .get(url.format(theURLOBJ))
      .expect(200)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`${paramName} - Expected type integer but`);
      });
  });

  if (typeof(constraints.min) !== 'undefined') {
    it(`Should throw if ${constraints.min - 1} is passed for ${paramName}`, async () => {
      const theURLOBJ = url.parse(validURL, true);
      delete theURLOBJ.query[paramName];
      delete theURLOBJ.search;
      delete theURLOBJ.path;
      delete theURLOBJ.href;
      theURLOBJ.query[paramName] = `${constraints.min - 1}`;
      return supertest(initializer.appManager.expressApp)
        .get(url.format(theURLOBJ))
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain(`${paramName} - Value ${constraints.min - 1} is less than minimum`);
        });
    });
  }

  if (typeof(constraints.max) !== 'undefined') {
    const outOfRangeValue = new BigNumber(constraints.max).plus(1).toString();
    it(`Should throw if ${outOfRangeValue} is passed for ${paramName}`, async () => {
      const theURLOBJ = url.parse(validURL, true);
      delete theURLOBJ.query[paramName];
      delete theURLOBJ.search;
      delete theURLOBJ.path;
      delete theURLOBJ.href;
      theURLOBJ.query[paramName] = outOfRangeValue;
      return supertest(initializer.appManager.expressApp)
        .get(url.format(theURLOBJ))
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain(`${paramName} - Value ${outOfRangeValue} is greater than maximum`);
        });
    });
  }
}