import { ApiException, allowedOrigin, errorResponse, handleOptions } from "./http.ts";

export function serveParent(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    try {
      const options = handleOptions(req);
      if (options) return options;
      if (req.headers.get("origin") && !allowedOrigin(req)) {
        return errorResponse(req, "FORBIDDEN", "허용되지 않은 주소입니다", 403);
      }
      if (req.method !== "POST") {
        return errorResponse(req, "INVALID_INPUT", "POST만 가능합니다", 405);
      }
      return await handler(req);
    } catch (error) {
      if (error instanceof ApiException) return errorResponse(req, error.code, error.message, error.status);
      console.error(error);
      return errorResponse(req, "INVALID_INPUT", "요청을 처리하지 못했습니다", 500);
    }
  });
}
