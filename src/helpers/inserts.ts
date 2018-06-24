import * as pgp from 'pg-promise';
// NOTE: rawType and _rawDBType are needed for pg-promise to call the toPostgres method.
/**
 * Helper class for postgres inserts.
 */
export class Inserts {
  public rawType = true;
  // tslint:disable-next-line
  public _rawDBType = true;

  /**
   * Class constructor
   */
  constructor(private record: { table: string, values: any, fields: string[] },
              private values: any,
              private concat: boolean = false) {
    if (!record || !record.table || !record.values) {
      throw new Error('Inserts: Invalid record argument');
    }
    if (!values) {
      throw new Error('Inserts: Invalid value argument');
    }
  }

  /**
   * Return the fields in a template format
   */
  public namedTemplate() {
    return this.record.fields.map((field) => `\${${field}}`).join(',');
  }

  /**
   * Alias of namedTemplate()
   */
  public get _template() {
    return this.namedTemplate();
  }

  /**
   * Prepare and return the query template
   */
  public template() {
    let values: string;
    const fields = this.record.fields.map(pgp.as.name).join(',');
    if (this.concat) {
      values = '$1^';
    } else {
      values = '(' + this._template + ')';
    }
    return pgp.as.format(
      'INSERT INTO $1~ ($2^) VALUES $3^',
      [
        this.record.table,
        fields,
        values,
      ]
    );
  }

  /**
   * Replaces the variables in the template with their values
   */
  public toPostgres() {
    return this.values
      .map((v) => `(${pgp.as.format(this._template, v)})`)
      .join(',');
  }
}
