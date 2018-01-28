import BigNumber from 'bignumber.js';
import { expect } from 'chai';
import * as supertest from 'supertest';
import initializer from '../common/init';
import * as url from 'url';

export const checkPubKey = (paramName: string, baseUrl: string) => {
  it(`should throw if ${paramName} is not a valid publicKey`, async () => {
    return supertest(initializer.appManager.expressApp)
      .get(`${baseUrl}?${paramName}=1`)
      .expect(500)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`${paramName} - Object didn't pass validation for format publicKey`);
      });
  });
};

export const checkRequiredParam = (paramName: string, validUrl: string) => {
  it(`should throw if ${paramName} is not provided`, async () => {
    const theURLOBJ = url.parse(validUrl, true);
    delete theURLOBJ.query[paramName];
    delete theURLOBJ.search;
    delete theURLOBJ.path;
    delete theURLOBJ.href;
    return supertest(initializer.appManager.expressApp)
      .get(url.format(theURLOBJ))
      .expect(500)
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

export const checkIntParam = (paramName: string, baseUrl: string, constraints: { min?: number, max?: string | number } = {}) => {
  it(`should throw if ${paramName} is given as string`, async () => {
    return supertest(initializer.appManager.expressApp)
      .get(`${baseUrl}?${paramName}=ahaha`)
      .expect(500)
      .then((response) => {
        expect(response.body.success).is.false;
        expect(response.body.error).to.contain(`${paramName} - Expected type integer but`);
      });
  });

  if (typeof(constraints.min) !== 'undefined') {
    it(`Should throw if ${constraints.min - 1} is passed for ${paramName}`, async () => {
      return supertest(initializer.appManager.expressApp)
        .get(`${baseUrl}?${paramName}=${constraints.min - 1}`)
        .expect(500)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain(`${paramName} - Value ${constraints.min - 1} is less than minimum`);
        });
    });
  }

  if (typeof(constraints.max) !== 'undefined') {
    const outOfRangeValue = new BigNumber(constraints.max).add(1).toString();
    it(`Should throw if ${outOfRangeValue} is passed for ${paramName}`, async () => {
      return supertest(initializer.appManager.expressApp)
        .get(`${baseUrl}?${paramName}=${outOfRangeValue}`)
        .expect(500)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.contain(`${paramName} - Value ${outOfRangeValue} is greater than maximum`);
        });
    });
  }
}