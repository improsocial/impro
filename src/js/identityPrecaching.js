import { effect, untrack } from "/js/signals.js";

export function setUpIdentityPrecaching(dataLayer, identityResolver) {
  const setDid = (entity) => {
    if (entity) {
      identityResolver.setDidForHandle(entity.handle, entity.did);
    }
  };

  const seenPostUris = new Set();
  effect(() => {
    const postStores = [
      dataLayer.dataStore.$posts,
      dataLayer.dataStore.$embeddedPosts,
    ];
    for (const postStore of postStores) {
      for (const uri of postStore.keys()) {
        if (seenPostUris.has(uri)) continue;
        seenPostUris.add(uri);
        const post = untrack(() => postStore.get(uri));
        if (!post) continue;
        try {
          setDid(post.author);
        } catch (error) {
          console.error("error when setting DID from post", post);
          console.error(error);
        }
      }
    }
  });

  const seenFeedGeneratorUris = new Set();
  effect(() => {
    const uris = [...dataLayer.dataStore.$feedGenerators.keys()];
    for (const uri of uris) {
      if (seenFeedGeneratorUris.has(uri)) continue;
      seenFeedGeneratorUris.add(uri);
      const feedGenerator = untrack(() =>
        dataLayer.dataStore.$feedGenerators.get(uri),
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
  });

  effect(() => {
    const profileSearchResults =
      dataLayer.dataStore.$profileSearchResults.get();
    if (!profileSearchResults) return;
    for (const searchResult of profileSearchResults.actors) {
      setDid(searchResult);
    }
  });

  effect(() => {
    const typeaheadResults = dataLayer.dataStore.$searchTypeaheadResults.get();
    if (!typeaheadResults) return;
    for (const searchResult of typeaheadResults.actors) {
      setDid(searchResult);
    }
  });

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
  });

  effect(() => {
    const data = dataLayer.dataStore.$notifications.get();
    if (!data) return;
    for (const notification of data.notifications) {
      try {
        setDid(notification.author);
      } catch (error) {
        console.error("error when setting DID from notification", notification);
        console.error(error);
      }
    }
  });
}
