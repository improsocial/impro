import { getQuotedPost } from "/js/dataHelpers.js";
import { effect, untrack } from "/js/utils.js";

export function setUpIdentityPrecaching(dataLayer, identityResolver) {
  const setDid = (entity) => {
    if (entity) {
      identityResolver.setDidForHandle(entity.handle, entity.did);
    }
  };

  const seenPostUris = new Set();
  effect(() => {
    const uris = dataLayer.dataStore.$posts.$keys.get();
    for (const uri of uris) {
      if (seenPostUris.has(uri)) continue;
      seenPostUris.add(uri);
      const post = untrack(() => dataLayer.dataStore.$posts.get(uri).get());
      if (!post) continue;
      try {
        setDid(post.author);
      } catch (error) {
        console.error("error when setting DID from post", post);
        console.error(error);
      }
      try {
        const quotedPost = getQuotedPost(post);
        if (quotedPost) {
          setDid(quotedPost.author);
          // TODO - normalize quoted posts?
          const nestedQuotedPost = getQuotedPost(quotedPost);
          if (nestedQuotedPost) {
            setDid(nestedQuotedPost.author);
          }
        }
      } catch (error) {
        console.error("error when setting DID from quoted post", post);
        console.error(error);
      }
    }
  }, "identityPrecaching:posts");

  const seenFeedGeneratorUris = new Set();
  effect(() => {
    const uris = dataLayer.dataStore.$feedGenerators.$keys.get();
    for (const uri of uris) {
      if (seenFeedGeneratorUris.has(uri)) continue;
      seenFeedGeneratorUris.add(uri);
      const feedGenerator = untrack(() =>
        dataLayer.dataStore.$feedGenerators.get(uri).get(),
      );
      if (!feedGenerator) continue;
      try {
        setDid(feedGenerator.creator);
      } catch (error) {
        console.error(
          "error when setting DID from feed generator",
          feedGenerator,
        );
        console.error(error);
      }
    }
  }, "identityPrecaching:feedGenerators");

  effect(() => {
    const profileSearchResults =
      dataLayer.dataStore.$profileSearchResults.get();
    if (!profileSearchResults) return;
    for (const searchResult of profileSearchResults.actors) {
      setDid(searchResult);
    }
  }, "identityPrecaching:profileSearch");

  effect(() => {
    const preferences = dataLayer.preferencesProvider.$preferences.get();
    if (!preferences) return;
    for (const labelerDef of preferences.labelerDefs) {
      try {
        setDid(labelerDef.creator);
      } catch (error) {
        console.error("error when setting DID from labeler", labelerDef);
        console.error(error);
      }
    }
  }, "identityPrecaching:preferences");

  effect(() => {
    const notifications = dataLayer.dataStore.$notifications.get();
    if (!notifications) return;
    for (const notification of notifications) {
      try {
        setDid(notification.author);
      } catch (error) {
        console.error("error when setting DID from notification", notification);
        console.error(error);
      }
    }
  }, "identityPrecaching:notifications");
}
