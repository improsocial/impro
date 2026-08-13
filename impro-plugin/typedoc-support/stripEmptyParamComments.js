import { Converter, ReflectionKind } from "typedoc";

const isEmptyComment = (comment) => {
  if (!comment) return false;
  const hasSummary = comment.summary.some(
    (part) => part.text.trim().length > 0,
  );
  return !hasSummary && comment.blockTags.length === 0;
};

/**
 * A `@param {string} foo` tag with no trailing description still produces an
 * empty comment on the parameter, which makes typedoc-plugin-markdown render an
 * all-`-` "Description" column. Drop those so the column is omitted.
 */
export function load(app) {
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    for (const reflection of context.project.getReflectionsByKind(
      ReflectionKind.Parameter,
    )) {
      if (isEmptyComment(reflection.comment)) {
        reflection.comment = undefined;
      }
    }
  });
}
