import ky from "ky";
import { z } from "zod";

const NaverSearchItemSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  description: z.string().optional(),
});

const NaverSearchResponseSchema = z.object({
  items: z.array(NaverSearchItemSchema),
});

export type NaverSearchItem = z.infer<typeof NaverSearchItemSchema>;

export type NaverRequesterOptions = {
  readonly searchParams: {
    readonly query: string;
    readonly display: string;
  };
  readonly timeout: number;
  readonly headers: {
    readonly "X-Naver-Client-Id": string;
    readonly "X-Naver-Client-Secret": string;
  };
  readonly retry: {
    readonly limit: number;
  };
};

export type NaverRequester = (endpoint: string, options: NaverRequesterOptions) => Promise<unknown>;

export class NaverClientConfigurationError extends Error {
  readonly code = "NAVER_CLIENT_CONFIGURATION_INVALID";

  constructor(message = "Naver client credentials are required.") {
    super(message);
    this.name = "NaverClientConfigurationError";
  }
}

export class NaverApiRequestError extends Error {
  readonly code = "NAVER_API_REQUEST_FAILED";
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Naver API request failed.");
    this.name = "NaverApiRequestError";
    this.cause = cause;
  }
}

export class NaverApiResponseError extends Error {
  readonly code = "NAVER_API_RESPONSE_INVALID";
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Naver API response schema validation failed.");
    this.name = "NaverApiResponseError";
    this.cause = cause;
  }
}

const defaultRequester: NaverRequester = async (endpoint, options) =>
  await ky.get(endpoint, options).json<unknown>();

function assertCredential(value: string, name: string): void {
  if (value.trim() === "") {
    throw new NaverClientConfigurationError(`${name} is required.`);
  }
}

export function shouldRunNaverLiveSmoke(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { readonly run: true } | { readonly run: false; readonly reason: string } {
  if (env["RUN_NAVER_LIVE"] !== "1") {
    return { run: false, reason: "RUN_NAVER_LIVE is not 1." };
  }
  if (env["NAVER_CLIENT_ID"]?.trim() === "") {
    return { run: false, reason: "NAVER_CLIENT_ID is missing." };
  }
  if (env["NAVER_CLIENT_ID"] === undefined) {
    return { run: false, reason: "NAVER_CLIENT_ID is missing." };
  }
  if (env["NAVER_CLIENT_SECRET"]?.trim() === "") {
    return { run: false, reason: "NAVER_CLIENT_SECRET is missing." };
  }
  if (env["NAVER_CLIENT_SECRET"] === undefined) {
    return { run: false, reason: "NAVER_CLIENT_SECRET is missing." };
  }
  return { run: true };
}

export type NaverClientConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly blogSearchUrl: string;
  readonly shoppingSearchUrl: string;
  readonly timeoutMs: number;
};

export class NaverClient {
  readonly #config: NaverClientConfig;
  readonly #requester: NaverRequester;

  constructor(config: NaverClientConfig, requester: NaverRequester = defaultRequester) {
    assertCredential(config.clientId, "NAVER_CLIENT_ID");
    assertCredential(config.clientSecret, "NAVER_CLIENT_SECRET");
    this.#config = config;
    this.#requester = requester;
  }

  async searchBlog(query: string): Promise<readonly NaverSearchItem[]> {
    return this.search(this.#config.blogSearchUrl, query);
  }

  async searchShopping(query: string): Promise<readonly NaverSearchItem[]> {
    return this.search(this.#config.shoppingSearchUrl, query);
  }

  private async search(endpoint: string, query: string): Promise<readonly NaverSearchItem[]> {
    let response: unknown;
    try {
      response = await this.#requester(endpoint, {
        searchParams: { query, display: "10" },
        timeout: this.#config.timeoutMs,
        headers: {
          "X-Naver-Client-Id": this.#config.clientId,
          "X-Naver-Client-Secret": this.#config.clientSecret,
        },
        retry: { limit: 1 },
      });
    } catch (error) {
      throw new NaverApiRequestError(error);
    }

    const parsed = NaverSearchResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new NaverApiResponseError(parsed.error);
    }

    return parsed.data.items;
  }
}
