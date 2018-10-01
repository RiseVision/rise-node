import { DeprecatedAPIError } from "../../apis/errors";
import { OpenAPI, ResponseSchema } from "rc-openapi-gen";
import { HttpCode } from "routing-controllers";

export function DeprecatedEndpoint() {
  return (
    target: any,
    property: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>
  ) => {
    HttpCode(500)(target, property, descriptor);
    OpenAPI({ deprecated: true })(target, property, descriptor);
    ResponseSchema("responses.deprecated", {
      statusCode: 500,
      description: "Deprecated API Error"
    })(target, property, descriptor);
    descriptor.value = function(...args) {
      throw new DeprecatedAPIError();
    };
  };
}
