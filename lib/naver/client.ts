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

export type NaverClientConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly blogSearchUrl: string;
  readonly shoppingSearchUrl: string;
  readonly timeoutMs: number;
};

export class NaverClient {
  readonly #config: NaverClientConfig;

  constructor(config: NaverClientConfig) {
    this.#config = config;
  }

  async searchBlog(query: string): Promise<readonly NaverSearchItem[]> {
    return this.search(this.#config.blogSearchUrl, query);
  }

  async searchShopping(query: string): Promise<readonly NaverSearchItem[]> {
    return this.search(this.#config.shoppingSearchUrl, query);
  }

  private async search(endpoint: string, query: string): Promise<readonly NaverSearchItem[]> {
    const response = await ky
      .get(endpoint, {
        searchParams: { query, display: "10" },
        timeout: this.#config.timeoutMs,
        headers: {
          "X-Naver-Client-Id": this.#config.clientId,
          "X-Naver-Client-Secret": this.#config.clientSecret,
        },
        retry: { limit: 1 },
      })
      .json<unknown>();

    return NaverSearchResponseSchema.parse(response).items;
  }
}
