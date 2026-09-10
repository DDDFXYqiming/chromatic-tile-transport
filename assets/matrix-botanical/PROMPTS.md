# 原创素材与生成提示词

使用内置 `image_gen` 工具，未使用 API/CLI fallback。选定 PNG 原样复制到本目录，保留生成的 alpha。人物、鱼和最终花枝均已验证为 RGBA，包含完全透明像素。两张带有绘制棋盘格的花枝试稿未使用。

| 最终素材 | 用途 | 生成参考 |
|---|---|---|
| [character.png](character.png) | 人物 | 无，原创生成 |
| [background.png](background.png) | 留白背景 | 人物图的配色与线条 |
| [fish.png](fish.png) | 游鱼 | 人物图的配色与线条 |
| [flowers.png](flowers.png) | 远近花枝 | 无，按相同方向生成 |

预览 WebP 由网页代码渲染，未调用额外图像生成。下列是选定素材的最终提示词；参考人物图对应本目录的 `character.png`。

## 人物

```text
Use case: stylized-concept. Asset type: a single transparent PNG character layer for an original blue-and-white 2.5D editorial web animation. Create an original adult woman, around 25, upper body from the top of her hair to her hips, with both sleeves and all flowing hair tips fully inside the canvas. Calm thoughtful expression, refined anime illustration, short midnight-blue bob with several longer flowing locks, clear pale-cyan eyes, white high-collar loose coat with dark navy sculptural panels and one elegant cyan ribbon. Three-quarter pose turned slightly toward the viewer's left, arms relaxed. Delicate precise navy ink outlines, very controlled cel shading, beautiful face and textile detail, contemporary botanical art-direction, exclusively paper ivory, ice blue, muted cyan and midnight navy. No existing game character, no logos, no text, no flowers, no scenery, no frame. Composition: isolated single figure centered with a transparent margin on all sides, portrait 2:3 canvas, high resolution suitable for a face closeup. Background MUST be genuinely transparent with alpha, not white and not a checkerboard illustration; no cast shadow on a backdrop. This is a production layer, not a finished poster or a contact sheet.
```

## 背景

```text
Use case: stylized-concept. Create a NEW background-only production layer for the same original editorial botanical animation as the reference character. The reference supplies only the navy/ice-blue/ivory palette and refined ink illustration style; do NOT include the woman or any human. Wide landscape 16:9, preferably 2048x1152. An airy paper-ivory space with faint pale-cyan atmospheric washes, very fine barely visible botanical line silhouettes limited to the far right and bottom edges, quiet distant water-like curved contours, a subtle luminous blue haze near the lower right. Most of the left two thirds and upper center must remain uncluttered and nearly paper white, so a separately composited character, flowers and titles have room to move. Clean refined illustration, generous negative space, continuous usable painted background to every edge, subtle paper grain only. No foreground blossoms, no fish, no human figures, no dark vignettes, no typography, no logos, no borders, no interface. This is an opaque clean background plate, not the finished scene.
```

## 鱼

```text
Use case: stylized-concept. Asset type: one genuinely transparent RGBA fish layer for an original 2.5D editorial animation, matching only the refined navy ink illustration style and limited ice-blue / paper-white / midnight palette of the reference portrait. A single elegant dark navy koi fish in a graceful side view, swimming toward the left, with long flowing pale-cyan ribbon fins and a curved fan tail. Delicate luminous highlights along scales and translucent-looking fins, beautiful readable silhouette, restrained detailed anime botanical editorial drawing, not photorealistic. Landscape 3:2 image, complete fish and all fins contained with empty transparent margins. Only this one fish. No woman, no plants, no water scene, no cast shadow, no typography or frame. Background must be actual fully transparent alpha in the output PNG, never a painted checkerboard, gray rectangle, black gradient or white matte. This isolated asset will be composited in code.
```

## 花枝

```text
Create one isolated blue-and-white iris flower branch as a transparent PNG sprite for a 2.5D web animation. Wide landscape 3:2 composition, 1536 by 1024. Three large elegant iris blossoms connected by thin sweeping stems and a few long navy leaves, arranged in a graceful diagonal from lower left toward upper right. Refined editorial anime botanical illustration, delicate midnight-blue ink lines, ivory petals with ice-blue washes, controlled cel shading, subtle realistic petal detail. Keep the entire branch and leaf tips inside the canvas with generous empty transparent space. Only the flower branch. The area around and between all petals, leaves, stems is transparent alpha, ready to place over arbitrary backgrounds. Do not add a backdrop, scenery, text, frame, shadow, person or fish. Deliver an RGBA PNG with genuine transparency.
```
