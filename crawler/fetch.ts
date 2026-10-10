import {
  HttpError,
  type FetchInit,
  type FetchResponse,
  type Session,
} from "pantomime";

/** `session.fetch`, with `null` for a 404: the page does not exist. */
export async function fetchOrNull(
  session: Session,
  url: string,
  init?: FetchInit,
): Promise<FetchResponse | null> {
  try {
    return await session.fetch(url, init);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
