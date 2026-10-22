import { versioned } from "@/lib/assets";
import type { Asset } from "@/lib/content";
import { reactProps } from "@/lib/html";

const attrs = (a?: Record<string, string>) => reactProps(Object.entries(a ?? {}));

/**
 * The design's <link>s, <style>s and <script>s, in the order its pages printed
 * them. They are plain elements in the server HTML, so the browser loads and
 * runs them exactly as it did on the reference site.
 */
export function Assets({ list }: { list: Asset[] }) {
  return list.map((asset, i) => {
    switch (asset.kind) {
      case "stylesheet":
        return <link key={i} rel="stylesheet" href={versioned(asset.href)} media={asset.media} />;
      case "preload":
        return (
          <link key={i} rel="preload" href={asset.plain ? asset.href : versioned(asset.href)} as={asset.as} type={asset.type} crossOrigin={asset.crossOrigin as "anonymous" | undefined} />
        );
      case "style":
        return <style key={i} {...attrs(asset.attrs)} dangerouslySetInnerHTML={{ __html: asset.css }} />;
      case "meta":
        return <meta key={i} {...attrs(asset.attrs)} />;
      case "script":
        return asset.src ? (
          // The design's scripts keep the loading they had (async/defer only where it set them):
          // later scripts depend on earlier ones having run, in order.
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script key={i} {...attrs(asset.attrs)} src={versioned(asset.src)} suppressHydrationWarning />
        ) : (
          <script key={i} {...attrs(asset.attrs)} dangerouslySetInnerHTML={{ __html: asset.code ?? "" }} suppressHydrationWarning />
        );
    }
  });
}
