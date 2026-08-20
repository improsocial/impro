import { effect, untrack } from "/js/signals.js";
import { notificationsQueryKey, Resources } from "/js/dataLayer/queryKeys.js";

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

  const seenProfileSearchDids = new Set();
  effect(() => {
    for (const queryKey of dataLayer.queryStore.keysForResource(
      Resources.PROFILE_SEARCH,
    )) {
      for (const did of dataLayer.queryStore.getItems(queryKey) ?? []) {
        if (seenProfileSearchDids.has(did)) continue;
        seenProfileSearchDids.add(did);
        setDid(untrack(() => dataLayer.dataStore.$profiles.get(did)));
      }
    }
  });

  const seenTypeaheadDids = new Set();
  effect(() => {
    for (const queryKey of dataLayer.queryStore.keysForResource(
      Resources.SEARCH_TYPEAHEAD,
    )) {
      for (const did of dataLayer.queryStore.getItems(queryKey) ?? []) {
        if (seenTypeaheadDids.has(did)) continue;
        seenTypeaheadDids.add(did);
        setDid(untrack(() => dataLayer.dataStore.$profiles.get(did)));
      }
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
    const notifications = dataLayer.queryStore.getItems(
      notificationsQueryKey(),
    );
    if (!notifications) return;
    for (const notification of notifications) {
      try {
        setDid(notification.author);
      } catch (error) {
        console.error("error when setting DID from notification", notification);
        console.error(error);
      }
    }
  });
}
