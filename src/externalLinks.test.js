import { appTarget } from "./externalLinks";
const url = "https://www.youtube.com/results?search_query=rock%20%26%20roll";
test("Android opens YouTube and preserves encoded searches", () => {
  const link = appTarget(url, {}, { userAgent: "Android" });
  expect(link.url).toBe("intent://www.youtube.com/results?search_query=rock%20%26%20roll#Intent;scheme=https;package=com.google.android.youtube;end");
  expect(link.fallbackUrl).toBe(url);
  expect(link.target).toBe("_self");
});
test.each([{ userAgent: "iPhone" }, { userAgent: "Macintosh", maxTouchPoints: 5 }])("iOS and desktop-mode iPad use native links", device => {
  expect(appTarget(url, {}, device).url).toBe("youtube://www.youtube.com/results?search_query=rock%20%26%20roll");
});
test("desktop and unsupported sites keep their web links", () => {
  expect(appTarget(url, {}, { userAgent: "Windows" }).url).toBe(url);
  expect(appTarget("https://github.com", {}, { userAgent: "Android" }).url).toBe("https://github.com");
});
