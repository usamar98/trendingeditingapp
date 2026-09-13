import type { ReactNode } from "react";
import Link from "next/link";

type GuideSection = { id: string; title: string; content: ReactNode };
export type Guide = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  image: string;
  imageAlt: string;
  published: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "1980s-ai-photo-prompts",
    title: "1980s AI photo prompts: find your kind of retro",
    seoTitle: "1980s AI Photo Prompts: 3 Retro Portrait Styles",
    description:
      "Explore three original 80s AI photo prompts, compare studio and cinematic styling, and learn how to turn a selfie into a believable retro portrait.",
    intro:
      "The best starting point for an 80s portrait is a specific photographic scene. Pick the light, clothes and background that belong together, then keep your face at the center of the edit.",
    image: "/images/studio.webp",
    imageAlt:
      "AI-created 80s studio demonstration with a cream blazer and mottled blue backdrop",
    published: "2026-09-12",
    sections: [
      {
        id: "the-trend",
        title: "What is the 1980s AI photo trend?",
        content: (
          <>
            <p>
              The idea is to restyle a present-day selfie as a portrait that
              could belong in an older studio collection, film publicity folder
              or family album. An AI edit can change clothing, hair and
              surroundings as well as color. A vintage filter usually changes
              the appearance of the existing photograph without rebuilding those
              details.
            </p>
            <p>
              On September 10, 2026,{" "}
              <a href="https://indianexpress.com/article/trending/trending-in-india/chatgpt-80s-photo-trend-prompt-10870120/">
                The Indian Express reported on the 80s photo trend
              </a>
              . On September 11,{" "}
              <a href="https://www.the-star.co.ke/news/2026-09-11-ai-trend-brings-1980s-style-back-on-social-media">
                The Star described retro AI portraits on Instagram and TikTok
              </a>
              . These reports show social-media activity; they do not establish
              a search-volume increase for EditingApp or predict how a
              particular portrait will perform.
            </p>
            <p>
              You do not have to reproduce a trending post exactly. A restrained
              studio portrait can feel more convincing than adding every period
              detail at once. The examples on this site are clearly labeled AI
              demonstrations with a fictional subject. They illustrate an
              intended look, not a measured promise of what your upload will
              produce.
            </p>
          </>
        ),
      },
      {
        id: "choose-a-style",
        title: "Choose the scene before writing the prompt",
        content: (
          <>
            <div
              className="guide-table-wrap"
              role="region"
              aria-label="Retro style comparison"
              tabIndex={0}
            >
              <table>
                <caption>Three ways to style one portrait</caption>
                <thead>
                  <tr>
                    <th scope="col">Style</th>
                    <th scope="col">Visual ingredients</th>
                    <th scope="col">Choose it for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">80s Studio</th>
                    <td>
                      Soft frontal flash, tailored clothing, blue studio
                      backdrop
                    </td>
                    <td>A composed, classic head-and-shoulders portrait</td>
                  </tr>
                  <tr>
                    <th scope="row">Retro Cinema</th>
                    <td>Burgundy clothing, amber light, teal shadows</td>
                    <td>A more dramatic publicity-photo mood</td>
                  </tr>
                  <tr>
                    <th scope="row">Vintage Family Album</th>
                    <td>Knitwear, warm window light, softly faded color</td>
                    <td>An informal single-person keepsake</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              EditingApp offers these as presets, so no prompt entry is needed
              in the studio. The prompts below are original writing examples
              that explain the direction behind each look. If you use another
              editor that accepts reference-image prompts, adapt them to its
              supported controls. Different models can interpret the same
              wording differently.
            </p>
            <p>
              Vintage Family Album describes the photographic style. The current
              app edits one person; it does not combine relatives or create a
              new group photograph. Similarly, Retro Cinema makes a still
              portrait, not a film clip or a poster with credits.
            </p>
          </>
        ),
      },
      {
        id: "studio-prompt",
        title: "Prompt 1: a classic 80s studio portrait",
        content: (
          <>
            <p>
              Start here if you want an uncluttered background and a face that
              is easy to inspect. Let the jacket, hair volume and light provide
              the period cues. An even, softly lit input is a practical match
              for this scene.
            </p>
            <blockquote className="prompt-example">
              <p>
                Edit the reference photo into a realistic 1980s studio portrait
                of the same person. Preserve their age, skin tone, facial
                proportions and expression. Use a cream tailored jacket,
                tasteful period hair volume and a mottled blue backdrop. Light
                the face with soft frontal studio flash. Keep natural skin
                texture, believable fabric and restrained film grain. Frame the
                head and shoulders vertically. Do not add text, logos or other
                people.
              </p>
            </blockquote>
            <p>
              The important boundary is between facial identity and styling.
              Hair can carry the 1980s look without hiding the eyes or replacing
              the hairline. A soft backdrop also makes changes to the outline of
              the face easier to spot. If a result seems overly polished,
              examine the cheeks and under-eye detail rather than judging only
              the clothes.
            </p>
          </>
        ),
      },
      {
        id: "cinema-prompt",
        title: "Prompt 2: a cinematic retro portrait",
        content: (
          <>
            <p>
              A cinematic look depends on where light falls. Specify one warm
              light direction and restrained shadow color. Asking for neon, lens
              flares, smoke, a busy street and strong blur together can distract
              from the face.
            </p>
            <blockquote className="prompt-example">
              <p>
                Create a photorealistic 1980s publicity portrait from this
                reference image. Keep the same recognizable person, expression,
                age and complexion. Use burgundy period clothing, a softly
                blurred background, warm amber side light and subtle teal
                shadows. Keep both eyes readable and facial features in focus.
                Add fine analog grain without heavy skin smoothing. Make a
                vertical portrait without a movie title, credits or a second
                person.
              </p>
            </blockquote>
            <p>
              Check the shadowed side of the face carefully. Dramatic light can
              change the apparent shape of a nose or cheek even when the result
              looks attractive. The relevant question is whether you still
              recognize the person. If identity is difficult to judge, try the
              more evenly lit studio preset on a later attempt rather than
              accepting an ambiguous face.
            </p>
          </>
        ),
      },
      {
        id: "album-prompt",
        title: "Prompt 3: a vintage family album keepsake",
        content: (
          <>
            <p>
              For a quieter result, choose an everyday setting and familiar
              materials. Knitwear, a simple home interior and window light can
              suggest an album photograph without adding artificial scratches or
              a false date stamp.
            </p>
            <blockquote className="prompt-example">
              <p>
                Restyle this single-person reference photo as a realistic
                portrait from a 1980s family album. Preserve the subject’s
                recognizable facial features, age, expression and skin tone. Use
                cozy knitwear, warm window light and a modest home backdrop.
                Give the photograph gently faded analog colors and light grain,
                while keeping the face sharp. Include only the reference person.
                Do not add an album frame, handwriting, damage or a date stamp.
              </p>
            </blockquote>
            <p>
              This is an imagined keepsake, not evidence of a past event. Avoid
              captions that suggest the picture documents a real year,
              relationship or occasion. If you want to restore an actual old
              photograph, choose a restoration workflow; EditingApp’s presets
              intentionally reinterpret its styling.
            </p>
          </>
        ),
      },
      {
        id: "use-editingapp",
        title: "Make the portrait in EditingApp",
        content: (
          <>
            <ol>
              <li>
                <strong>Choose a style.</strong> Open the{" "}
                <Link href="/tools/ai-retro-portraits#studio">
                  AI retro portrait generator
                </Link>{" "}
                and select 80s Studio, Retro Cinema or Vintage Family Album. You
                can inspect the demonstration before uploading.
              </li>
              <li>
                <strong>Add your selfie.</strong> Use one clear face in a JPG,
                PNG or WebP under 4 MB. Export HEIC to JPG first. The image must
                be at least 256 × 256 pixels and at most 16 megapixels.
              </li>
              <li>
                <strong>Check the cost.</strong> A standard image uses 3 credits
                and high detail uses 8 under credit plans. The studio shows your
                current credits or allowance before submission. Choose a detail
                level you can afford; shared service limits also apply.
              </li>
              <li>
                <strong>Generate and review.</strong> Confirm you have
                permission to edit the photo. Verify your email when requested,
                submit once, and wait for the actual request status. Compare
                your original with the result before deciding to keep it.
              </li>
              <li>
                <strong>Download your choice.</strong> Save the portrait PNG or
                the labeled before-and-after composition. Sharing is your
                decision; the app does not publish a gallery or post to your
                social account.
              </li>
            </ol>
            <p>
              Advanced detail settings are optional and do not guarantee a
              better likeness. If a connection is interrupted, use Check request
              to retrieve the existing attempt. An uncertain request stays
              reserved while its outcome is unresolved; a confirmed failure
              restores its allowance. Submitting the same photo as a new attempt
              is a separate generation.
            </p>
          </>
        ),
      },
      {
        id: "review-and-share",
        title: "A useful final check before you share",
        content: (
          <>
            <p>
              Look at the original and result at a comparable size. Check the
              spacing of the eyes, nose shape, mouth, jawline and distinctive
              marks. Look separately at age, skin tone and expression. A
              convincing jacket does not compensate for a face that feels
              unfamiliar. Our{" "}
              <Link href="/guides/better-ai-portrait-likeness">
                selfie and likeness guide
              </Link>{" "}
              explains how to choose a stronger input and inspect the result.
            </p>
            <p>
              Then check the photographic details: hair edges should be
              plausible, clothing should not melt into the neck, and earrings or
              glasses should have a consistent shape. Heavy grain can hide these
              problems at thumbnail size. Use the downloaded image at full size
              before deciding it is ready to share.
            </p>
            <p>
              A simple caption such as “My AI-created 80s studio portrait” makes
              the transformation clear. You can use the before-and-after
              download to show the starting point, but remember that it includes
              your original selfie. Review both halves for anything you would
              prefer to keep private.
            </p>
            <p>
              Your local preview is not uploaded until you generate. Submitted
              photos are processed by external providers and stored privately;
              app access expires after 24 hours. Scheduled deletion depends on
              cleanup configuration. Read the{" "}
              <Link href="/privacy">photo privacy notice</Link> before uploading
              an image you consider sensitive.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "better-ai-portrait-likeness",
    title: "How to help an AI retro portrait look like you",
    seoTitle: "Better AI Portrait Likeness: Selfie & Review Guide",
    description:
      "Choose a clearer selfie, avoid common upload problems, and check your AI portrait’s facial details before downloading a retro photo or before-and-after.",
    intro:
      "An attractive portrait and a recognizable portrait are not always the same thing. Give the editor a clear view of your face, then compare the result with that reference before keeping it.",
    image: "/images/album.webp",
    imageAlt:
      "AI-created vintage album demonstration with knitwear and warm window lighting",
    published: "2026-09-12",
    sections: [
      {
        id: "clear-reference",
        title: "Start with a face you can see clearly",
        content: (
          <>
            <p>
              Choose a recent, unfiltered photograph that looks like you. The
              goal is to give the editor visible information about your eyes,
              nose, mouth, jaw and skin texture. Enlarging a tiny face or
              sharpening a blurred photo cannot reliably recover detail that was
              never captured.
            </p>
            <p>
              A head-and-shoulders selfie with a little space above the hair and
              beside the face is a practical starting point. Avoid cropping
              through your chin or the top of your head. A plain wall helps you
              judge the outline, but you do not need professional equipment or a
              perfectly empty room.
            </p>
            <p>
              Use one person. A distant group shot leaves too little facial
              detail and can make the intended subject unclear. EditingApp’s
              Vintage Family Album preset creates a single-person portrait in an
              album style. Its name does not mean it can reconstruct a family
              group.
            </p>
            <p>
              Try facing a window with the light spread across your face. Avoid
              strong backlighting, which can leave the face dark, and direct
              overhead light that hides the eyes in shadow. Before uploading,
              view the photo at normal size and ask whether both eyes and the
              full mouth are easy to see.
            </p>
          </>
        ),
      },
      {
        id: "avoid-obstructions",
        title: "Remove things that make identity harder to judge",
        content: (
          <>
            <p>
              Sunglasses, a hand across the face, strong glare and hair covering
              an eye can hide useful reference detail. A heavy beauty filter may
              already have changed your skin texture, face shape or eye size.
              Editing that image can carry those changes into the result.
            </p>
            <p>
              If glasses are part of your everyday appearance, use an image with
              clear lenses and little reflection. Check the generated frame
              shape and alignment afterwards. You do not have to erase
              recognizable characteristics to fit a retro style; those
              characteristics are part of what makes the portrait yours.
            </p>
            <p>
              A neutral or familiar expression can be easier to compare than an
              extreme pose. Avoid a very close wide-angle selfie that noticeably
              stretches the center of the face. If that is the only image
              available, take a new photo a little farther from the camera
              instead of trying to solve all the distortion with a prompt.
            </p>
            <p>
              Changing just the source photograph is often a more understandable
              experiment than changing the source, style and detail setting
              together. Keep track of what you changed so that you can decide
              whether it helped. Each new submission uses another attempt; there
              is no need to use all your credits or allowance on repeated
              guesses.
            </p>
          </>
        ),
      },
      {
        id: "upload-checklist",
        title: "Check the file before uploading",
        content: (
          <>
            <ul>
              <li>
                <strong>Format:</strong> use a still JPG, PNG or WebP. Renaming
                a HEIC file to .jpg does not convert it; export or convert it
                first.
              </li>
              <li>
                <strong>File size:</strong> keep it under 4 MB. If needed,
                export at a smaller resolution while keeping facial detail
                visible.
              </li>
              <li>
                <strong>Dimensions:</strong> each side must be at least 256
                pixels, and the complete image must be no more than 16
                megapixels.
              </li>
              <li>
                <strong>Content:</strong> choose one clearly visible face and an
                image you have permission to edit. A screenshot with app
                controls or text is a less useful reference than the original
                photo file.
              </li>
            </ul>
            <p>
              Use the preview to check orientation and cropping before you
              submit. Selection only creates a browser preview. The app sends
              the image for processing when you generate, after you have
              reviewed the style, allowance and consent controls.
            </p>
            <p>
              When the app reports an invalid upload, fix the named issue first.
              A wrong format needs conversion; an oversize image needs a smaller
              export. Retrying the same invalid file will not make it a
              supported image. Keep your original unchanged so that you have a
              reference for the final comparison.
            </p>
          </>
        ),
      },
      {
        id: "style-and-identity",
        title: "Separate the style you want from the face you know",
        content: (
          <>
            <p>
              Retro styling can come from clothing, hair volume, background,
              color and light. Identity depends on a different set of details.
              EditingApp’s instructions ask the model to preserve facial
              proportions, age, complexion, expression and distinctive features
              while changing the scene around them. An instruction is a
              preference for the model, not a guarantee.
            </p>
            <p>
              Start with 80s Studio if you want an evenly lit result to inspect.
              Retro Cinema deliberately introduces stronger shadows and color
              contrast. Vintage Family Album aims for a softer everyday scene.
              Our{" "}
              <Link href="/guides/1980s-ai-photo-prompts#choose-a-style">
                retro style comparison
              </Link>{" "}
              shows what each preset is designed to change.
            </p>
            <p>
              A higher detail option can affect the image’s treatment but does
              not certify facial accuracy. Keep the default if you do not have a
              particular reason to change it. Compare the actual output instead
              of treating any model setting as a quality score.
            </p>
          </>
        ),
      },
      {
        id: "compare-the-face",
        title: "Review the face before the outfit",
        content: (
          <>
            <p>
              Use the side-by-side view first, at a similar face size. Look at
              one feature at a time instead of switching rapidly between the
              entire images. The comparison slider is useful afterwards for
              checking the outline and relative placement of details.
            </p>
            <ol>
              <li>
                <strong>Eyes and eyebrows:</strong> compare spacing, shape, gaze
                and asymmetry. Look for a changed eye color or an eyelid that
                does not match the original.
              </li>
              <li>
                <strong>Nose and mouth:</strong> check the bridge, tip, lip
                outline and expression. If teeth are visible, inspect their
                overall consistency.
              </li>
              <li>
                <strong>Face shape:</strong> compare the jaw, cheeks, chin and
                hairline. Period styling should not require a different
                underlying face.
              </li>
              <li>
                <strong>Age and skin:</strong> look for changes to complexion,
                texture, wrinkles or distinctive marks. Attractive smoothing can
                still make a portrait less recognizable.
              </li>
              <li>
                <strong>Accessories and edges:</strong> check glasses, earrings,
                hair, collar and shoulders for distortions that a small preview
                could hide.
              </li>
            </ol>
            <p>
              Light and camera angle can change how a feature appears, so the
              two images do not need to align pixel for pixel. The practical
              test is whether the result preserves the recognizable person. If
              it does not, you can decide not to download it. A result being
              technically complete is not a reason to keep it.
            </p>
          </>
        ),
      },
      {
        id: "when-it-goes-wrong",
        title: "Handle a poor result differently from a failed request",
        content: (
          <>
            <p>
              A completed image that you do not like is still a completed
              generation and uses its allowance. For a later attempt, choose a
              sharper, more evenly lit reference or a simpler preset. Repeating
              an identical request can produce a different image, but it does
              not guarantee a correction.
            </p>
            <p>
              A confirmed generation failure restores the reserved allowance. An
              uncertain request is different: the provider may still be working
              even if your connection stopped. Use Check request to look up that
              same job. Avoid submitting a new generation simply because the
              previous one is taking longer than expected.
            </p>
            <p>
              If the app asks you to verify your email, finish signing in before
              generating. To retrieve a previous private portrait, use the same
              email account. Expired photo access and a usage limit are also
              different conditions; creating a new account or repeatedly
              submitting the form is not a useful fix for either.
            </p>
            <p>
              The studio reports actual request states rather than a guaranteed
              completion time. Read the displayed error, keep the request ID if
              you need to identify an attempt, and never share private sign-in
              links or verification codes in a public post.
            </p>
          </>
        ),
      },
      {
        id: "download-and-privacy",
        title: "Download only what you want to keep",
        content: (
          <>
            <p>
              The portrait download is a 1024 × 1536 PNG. The before-and-after
              download places your reference next to the generated portrait and
              labels the two views. It is composed in your browser; choosing it
              does not post to Instagram, TikTok or a public gallery.
            </p>
            <p>
              Open the file after downloading to check the full image. If you
              plan to crop it for a profile photo or a social post, leave enough
              space around the face for the platform’s crop. The built-in export
              is a portrait, not a promise of a perfect fit for every social
              layout.
            </p>
            <p>
              Keep a copy before photo access expires. EditingApp blocks access
              after 24 hours and offers a manual deletion control after
              processing. Automatic removal from storage requires scheduled
              cleanup; external providers have separate retention terms. The{" "}
              <Link href="/privacy">privacy notice</Link> explains these
              distinctions.
            </p>
            <p>
              Label a shared image as AI-created and make sure you are
              comfortable sharing the original if you use the comparison. When
              you are ready, return to the{" "}
              <Link href="/tools/ai-retro-portraits#studio">
                portrait studio
              </Link>
              , pick a style and start with your clearest selfie.
            </p>
          </>
        ),
      },
    ],
  },
];

export function findGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
