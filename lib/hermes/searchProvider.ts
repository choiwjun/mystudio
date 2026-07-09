import { collectInsaneSearchRawItems } from "@/lib/hermes/insaneSearchRawItems";
import {
  collectNaverRawItems,
  type NaverRawCollectionTarget,
  type RawItemInput,
} from "@/lib/hermes/rawItems";

export async function collectHermesSearchRawItems(
  query: string,
  target: NaverRawCollectionTarget,
): Promise<readonly RawItemInput[]> {
  const insaneSearchItems = await collectInsaneSearchRawItems({ query, target });
  return insaneSearchItems ?? collectNaverRawItems(query, target);
}

export async function collectHermesRawItems(query: string): Promise<readonly RawItemInput[]> {
  return collectHermesSearchRawItems(query, "all");
}
