# @impro.social/impro-plugin

## Classes

### App

#### Properties

| Property                                        | Type                        |
| ----------------------------------------------- | --------------------------- |
| <a id="property-currentuser"></a> `currentUser` | `any`                       |
| <a id="property-data"></a> `data`               | [`PluginData`](#plugindata) |

#### Methods

##### blockActor()

> **blockActor**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

##### muteActor()

> **muteActor**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

##### on()

> **on**(`event`, `listener`): `void`

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `event`    | `any` |
| `listener` | `any` |

###### Returns

`void`

##### refreshFeedFilters()

> **refreshFeedFilters**(`feedURI?`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  | Default value |
| --------- | ----- | ------------- |
| `feedURI` | `any` | `null`        |

###### Returns

`Promise`\<`any`\>

##### showLessLikeThis()

> **showLessLikeThis**(`postUri`, `feedUri`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `postUri` | `any` |
| `feedUri` | `any` |

###### Returns

`Promise`\<`any`\>

##### showMoreLikeThis()

> **showMoreLikeThis**(`postUri`, `feedUri`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `postUri` | `any` |
| `feedUri` | `any` |

###### Returns

`Promise`\<`any`\>

##### unblockActor()

> **unblockActor**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

##### unmuteActor()

> **unmuteActor**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

---

### BlobImageComponent

#### Properties

| Property                      | Type  |
| ----------------------------- | ----- |
| <a id="property-el"></a> `el` | `any` |

#### Methods

##### setAlt()

> **setAlt**(`alt`): [`BlobImageComponent`](#blobimagecomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `alt`     | `any` |

###### Returns

[`BlobImageComponent`](#blobimagecomponent)

##### setCdnPrefix()

> **setCdnPrefix**(`prefix`): [`BlobImageComponent`](#blobimagecomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `prefix`  | `any` |

###### Returns

[`BlobImageComponent`](#blobimagecomponent)

##### setCid()

> **setCid**(`cid`): [`BlobImageComponent`](#blobimagecomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `cid`     | `any` |

###### Returns

[`BlobImageComponent`](#blobimagecomponent)

##### setDid()

> **setDid**(`did`): [`BlobImageComponent`](#blobimagecomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

[`BlobImageComponent`](#blobimagecomponent)

---

### ButtonComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-1"></a> `el` | `any` |

#### Methods

##### onClick()

> **onClick**(`callback`): [`ButtonComponent`](#buttoncomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`ButtonComponent`](#buttoncomponent)

##### setButtonText()

> **setButtonText**(`text`): [`ButtonComponent`](#buttoncomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`ButtonComponent`](#buttoncomponent)

##### setCta()

> **setCta**(): [`ButtonComponent`](#buttoncomponent)

###### Returns

[`ButtonComponent`](#buttoncomponent)

---

### Composer

#### Constructors

##### Constructor

> **new Composer**(): [`Composer`](#composer)

###### Returns

[`Composer`](#composer)

#### Methods

##### appendText()

> **appendText**(`text`): [`Composer`](#composer)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`Composer`](#composer)

##### prependText()

> **prependText**(`text`): [`Composer`](#composer)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`Composer`](#composer)

##### setCursor()

> **setCursor**(`index`): [`Composer`](#composer)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `index`   | `any` |

###### Returns

[`Composer`](#composer)

##### setText()

> **setText**(`text`): [`Composer`](#composer)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`Composer`](#composer)

---

### DropdownComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-2"></a> `el` | `any` |

#### Methods

##### addOption()

> **addOption**(`value`, `label`): [`DropdownComponent`](#dropdowncomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |
| `label`   | `any` |

###### Returns

[`DropdownComponent`](#dropdowncomponent)

##### addOptions()

> **addOptions**(`map`): [`DropdownComponent`](#dropdowncomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `map`     | `any` |

###### Returns

[`DropdownComponent`](#dropdowncomponent)

##### onChange()

> **onChange**(`callback`): [`DropdownComponent`](#dropdowncomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`DropdownComponent`](#dropdowncomponent)

##### setValue()

> **setValue**(`value`): [`DropdownComponent`](#dropdowncomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`DropdownComponent`](#dropdowncomponent)

---

### FlattenedTokens

#### Constructors

##### Constructor

> **new FlattenedTokens**(`tokens`): [`FlattenedTokens`](#flattenedtokens)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `tokens`  | `any` |

###### Returns

[`FlattenedTokens`](#flattenedtokens)

#### Properties

| Property                          | Type     |
| --------------------------------- | -------- |
| <a id="property-text"></a> `text` | `string` |

#### Methods

##### textFor()

> **textFor**(`start`, `end`): `string`

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `start`   | `any` |
| `end`     | `any` |

###### Returns

`string`

##### tokensFor()

> **tokensFor**(`start`, `end`): `any`[]

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `start`   | `any` |
| `end`     | `any` |

###### Returns

`any`[]

---

### IconComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-3"></a> `el` | `any` |

#### Methods

##### setIcon()

> **setIcon**(`name`): [`IconComponent`](#iconcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `name`    | `any` |

###### Returns

[`IconComponent`](#iconcomponent)

---

### Menu

#### Constructors

##### Constructor

> **new Menu**(): [`Menu`](#menu)

###### Returns

[`Menu`](#menu)

#### Properties

| Property                            | Type    |
| ----------------------------------- | ------- |
| <a id="property-items"></a> `items` | `any`[] |

#### Methods

##### addItem()

> **addItem**(`builder`): [`Menu`](#menu)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `builder` | `any` |

###### Returns

[`Menu`](#menu)

---

### MenuItem

#### Constructors

##### Constructor

> **new MenuItem**(): [`MenuItem`](#menuitem)

###### Returns

[`MenuItem`](#menuitem)

#### Properties

| Property                            | Type     |
| ----------------------------------- | -------- |
| <a id="property-icon"></a> `icon`   | `any`    |
| <a id="property-title"></a> `title` | `string` |

#### Methods

##### onClick()

> **onClick**(`callback`): [`MenuItem`](#menuitem)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`MenuItem`](#menuitem)

##### setIcon()

> **setIcon**(`icon`): [`MenuItem`](#menuitem)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `icon`    | `any` |

###### Returns

[`MenuItem`](#menuitem)

##### setTitle()

> **setTitle**(`title`): [`MenuItem`](#menuitem)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `title`   | `any` |

###### Returns

[`MenuItem`](#menuitem)

---

### Modal

#### Constructors

##### Constructor

> **new Modal**(): [`Modal`](#modal)

###### Returns

[`Modal`](#modal)

#### Properties

| Property                                    | Type                      |
| ------------------------------------------- | ------------------------- |
| <a id="property-contentel"></a> `contentEl` | [`VirtualEl`](#virtualel) |
| <a id="property-titleel"></a> `titleEl`     | [`VirtualEl`](#virtualel) |

#### Methods

##### close()

> **close**(): `void`

###### Returns

`void`

##### onClose()

> **onClose**(): `void`

###### Returns

`void`

##### onOpen()

> **onOpen**(): `void`

###### Returns

`void`

##### open()

> **open**(): `void`

###### Returns

`void`

##### update()

> **update**(): `void`

###### Returns

`void`

---

### Notice

#### Constructors

##### Constructor

> **new Notice**(`message`, `timeout?`): [`Notice`](#notice)

###### Parameters

| Parameter | Type     | Default value |
| --------- | -------- | ------------- |
| `message` | `any`    | `undefined`   |
| `timeout` | `number` | `0`           |

###### Returns

[`Notice`](#notice)

#### Properties

| Property                                  | Type                      |
| ----------------------------------------- | ------------------------- |
| <a id="property-noticeel"></a> `noticeEl` | [`VirtualEl`](#virtualel) |

#### Methods

##### hide()

> **hide**(): `void`

###### Returns

`void`

##### setMessage()

> **setMessage**(`message`): [`Notice`](#notice)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `message` | `any` |

###### Returns

[`Notice`](#notice)

---

### Plugin

#### Constructors

##### Constructor

> **new Plugin**(): [`Plugin`](#plugin)

###### Returns

[`Plugin`](#plugin)

#### Properties

| Property                        | Type          |
| ------------------------------- | ------------- |
| <a id="property-app"></a> `app` | [`App`](#app) |

#### Methods

##### addFeedFilter()

> **addFeedFilter**(`callback?`): `void`

###### Parameters

| Parameter  | Type         |
| ---------- | ------------ |
| `callback` | () => `void` |

###### Returns

`void`

##### addSettingTab()

> **addSettingTab**(`tab`): `void`

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `tab`     | `any` |

###### Returns

`void`

##### addSidebarItem()

> **addSidebarItem**(`icon`, `title`, `callback?`): `void`

###### Parameters

| Parameter  | Type         |
| ---------- | ------------ |
| `icon`     | `any`        |
| `title`    | `any`        |
| `callback` | () => `void` |

###### Returns

`void`

##### loadData()

> **loadData**(): `Promise`\<`any`\>

###### Returns

`Promise`\<`any`\>

##### loadLocalData()

> **loadLocalData**(): `Promise`\<`any`\>

###### Returns

`Promise`\<`any`\>

##### onload()

> **onload**(): `void`

###### Returns

`void`

##### onunload()

> **onunload**(): `void`

###### Returns

`void`

##### openPage()

> **openPage**(`pageId`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `pageId`  | `any` |

###### Returns

`Promise`\<`any`\>

##### refreshPage()

> **refreshPage**(`pageId`, `__namedParameters?`): `Promise`\<`any`\>

###### Parameters

| Parameter                  | Type                       |
| -------------------------- | -------------------------- |
| `pageId`                   | `any`                      |
| `__namedParameters`        | \{ `reset?`: `boolean`; \} |
| `__namedParameters.reset?` | `boolean`                  |

###### Returns

`Promise`\<`any`\>

##### refreshSlot()

> **refreshSlot**(`name`, `options?`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `name`    | `any` |
| `options` | \{ \} |

###### Returns

`Promise`\<`any`\>

##### registerPage()

> **registerPage**(`__namedParameters`): `void`

###### Parameters

| Parameter                    | Type                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `__namedParameters`          | \{ `display?`: () => `any`; `id`: `any`; `title?`: `any`; \} |
| `__namedParameters.display?` | () => `any`                                                  |
| `__namedParameters.id`       | `any`                                                        |
| `__namedParameters.title?`   | `any`                                                        |

###### Returns

`void`

##### registerRichTextTransform()

> **registerRichTextTransform**(`callback?`, `options?`): `void`

###### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `callback` | (`tokens`) => `any` |
| `options`  | \{ \}               |

###### Returns

`void`

##### registerSlot()

> **registerSlot**(`name`, `callback?`, `options?`): `void`

###### Parameters

| Parameter  | Type        |
| ---------- | ----------- |
| `name`     | `any`       |
| `callback` | () => `any` |
| `options`  | \{ \}       |

###### Returns

`void`

##### saveData()

> **saveData**(`data`): `Promise`\<`void`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `data`    | `any` |

###### Returns

`Promise`\<`void`\>

##### saveLocalData()

> **saveLocalData**(`data`): `Promise`\<`void`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `data`    | `any` |

###### Returns

`Promise`\<`void`\>

##### register()

> `static` **register**(): `void`

###### Returns

`void`

---

### PluginData

#### Constructors

##### Constructor

> **new PluginData**(): [`PluginData`](#plugindata)

###### Returns

[`PluginData`](#plugindata)

#### Methods

##### getDetailedProfile()

> **getDetailedProfile**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

##### getKnownFollowers()

> **getKnownFollowers**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

##### getPost()

> **getPost**(`uri`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `uri`     | `any` |

###### Returns

`Promise`\<`any`\>

##### getProfile()

> **getProfile**(`did`): `Promise`\<`any`\>

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `did`     | `any` |

###### Returns

`Promise`\<`any`\>

##### getRecord()

> **getRecord**(`repo`, `collection`, `rkey`): `Promise`\<`any`\>

###### Parameters

| Parameter    | Type  |
| ------------ | ----- |
| `repo`       | `any` |
| `collection` | `any` |
| `rkey`       | `any` |

###### Returns

`Promise`\<`any`\>

---

### PluginResponse

#### Properties

| Property                                | Type                     |
| --------------------------------------- | ------------------------ |
| <a id="property-headers"></a> `headers` | `Map`\<`string`, `any`\> |
| <a id="property-ok"></a> `ok`           | `any`                    |
| <a id="property-status"></a> `status`   | `any`                    |

#### Methods

##### json()

> **json**(): `Promise`\<`any`\>

###### Returns

`Promise`\<`any`\>

##### text()

> **text**(): `Promise`\<`any`\>

###### Returns

`Promise`\<`any`\>

---

### PluginSettingTab

#### Constructors

##### Constructor

> **new PluginSettingTab**(): [`PluginSettingTab`](#pluginsettingtab)

###### Returns

[`PluginSettingTab`](#pluginsettingtab)

#### Properties

| Property                                        | Type                      |
| ----------------------------------------------- | ------------------------- |
| <a id="property-containerel"></a> `containerEl` | [`VirtualEl`](#virtualel) |
| <a id="property-name"></a> `name`               | `any`                     |

#### Methods

##### display()

> **display**(): `void`

###### Returns

`void`

##### refresh()

> **refresh**(`__namedParameters?`): `Promise`\<`any`\>

###### Parameters

| Parameter                  | Type                       |
| -------------------------- | -------------------------- |
| `__namedParameters`        | \{ `reset?`: `boolean`; \} |
| `__namedParameters.reset?` | `boolean`                  |

###### Returns

`Promise`\<`any`\>

##### setName()

> **setName**(`name`): [`PluginSettingTab`](#pluginsettingtab)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `name`    | `any` |

###### Returns

[`PluginSettingTab`](#pluginsettingtab)

---

### PostsFeedComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-4"></a> `el` | `any` |

#### Methods

##### setEmptyMessage()

> **setEmptyMessage**(`message`): [`PostsFeedComponent`](#postsfeedcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `message` | `any` |

###### Returns

[`PostsFeedComponent`](#postsfeedcomponent)

##### setUris()

> **setUris**(`uris`): [`PostsFeedComponent`](#postsfeedcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `uris`    | `any` |

###### Returns

[`PostsFeedComponent`](#postsfeedcomponent)

---

### ProfilesListComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-5"></a> `el` | `any` |

#### Methods

##### setDids()

> **setDids**(`dids`): [`ProfilesListComponent`](#profileslistcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `dids`    | `any` |

###### Returns

[`ProfilesListComponent`](#profileslistcomponent)

##### setEmptyMessage()

> **setEmptyMessage**(`message`): [`ProfilesListComponent`](#profileslistcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `message` | `any` |

###### Returns

[`ProfilesListComponent`](#profileslistcomponent)

---

### Setting

#### Constructors

##### Constructor

> **new Setting**(`containerEl`): [`Setting`](#setting)

###### Parameters

| Parameter     | Type  |
| ------------- | ----- |
| `containerEl` | `any` |

###### Returns

[`Setting`](#setting)

#### Properties

| Property                                    | Type  |
| ------------------------------------------- | ----- |
| <a id="property-controlel"></a> `controlEl` | `any` |
| <a id="property-descel"></a> `descEl`       | `any` |
| <a id="property-infoel"></a> `infoEl`       | `any` |
| <a id="property-nameel"></a> `nameEl`       | `any` |
| <a id="property-settingel"></a> `settingEl` | `any` |

#### Methods

##### addButton()

> **addButton**(`callback`): [`Setting`](#setting)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`Setting`](#setting)

##### addDropdown()

> **addDropdown**(`callback`): [`Setting`](#setting)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`Setting`](#setting)

##### addText()

> **addText**(`callback`): [`Setting`](#setting)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`Setting`](#setting)

##### addTextArea()

> **addTextArea**(`callback`): [`Setting`](#setting)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`Setting`](#setting)

##### addToggle()

> **addToggle**(`callback`): [`Setting`](#setting)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`Setting`](#setting)

##### setDesc()

> **setDesc**(`text`): [`Setting`](#setting)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`Setting`](#setting)

##### setName()

> **setName**(`text`): [`Setting`](#setting)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`Setting`](#setting)

---

### SimpleUUID

#### Constructors

##### Constructor

> **new SimpleUUID**(): [`SimpleUUID`](#simpleuuid)

###### Returns

[`SimpleUUID`](#simpleuuid)

#### Methods

##### create()

> **create**(): `number`

###### Returns

`number`

---

### StyleSnippet

#### Constructors

##### Constructor

> **new StyleSnippet**(`cssText`): [`StyleSnippet`](#stylesnippet)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `cssText` | `any` |

###### Returns

[`StyleSnippet`](#stylesnippet)

#### Properties

| Property                            | Type               |
| ----------------------------------- | ------------------ |
| <a id="property-ready"></a> `ready` | `Promise`\<`any`\> |

#### Methods

##### remove()

> **remove**(): `void`

###### Returns

`void`

---

### TextAreaComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-6"></a> `el` | `any` |

#### Methods

##### onChange()

> **onChange**(`callback`): [`TextAreaComponent`](#textareacomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`TextAreaComponent`](#textareacomponent)

##### setPlaceholder()

> **setPlaceholder**(`value`): [`TextAreaComponent`](#textareacomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`TextAreaComponent`](#textareacomponent)

##### setValue()

> **setValue**(`value`): [`TextAreaComponent`](#textareacomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`TextAreaComponent`](#textareacomponent)

---

### TextComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-7"></a> `el` | `any` |

#### Methods

##### onChange()

> **onChange**(`callback`): [`TextComponent`](#textcomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`TextComponent`](#textcomponent)

##### setPlaceholder()

> **setPlaceholder**(`value`): [`TextComponent`](#textcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`TextComponent`](#textcomponent)

##### setValue()

> **setValue**(`value`): [`TextComponent`](#textcomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`TextComponent`](#textcomponent)

---

### ToggleComponent

#### Properties

| Property                        | Type  |
| ------------------------------- | ----- |
| <a id="property-el-8"></a> `el` | `any` |

#### Methods

##### onChange()

> **onChange**(`callback`): [`ToggleComponent`](#togglecomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`ToggleComponent`](#togglecomponent)

##### setValue()

> **setValue**(`value`): [`ToggleComponent`](#togglecomponent)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`ToggleComponent`](#togglecomponent)

---

### VirtualEl

#### Constructors

##### Constructor

> **new VirtualEl**(`tag`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `tag`     | `any` |

###### Returns

[`VirtualEl`](#virtualel)

#### Properties

| Property                                  | Type     |
| ----------------------------------------- | -------- |
| <a id="property-attrs"></a> `attrs`       | `object` |
| <a id="property-children"></a> `children` | `any`[]  |
| <a id="property-events"></a> `events`     | `object` |
| <a id="property-styles"></a> `styles`     | `object` |
| <a id="property-tag"></a> `tag`           | `any`    |

#### Methods

##### addClass()

> **addClass**(`cls`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `cls`     | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### appendChild()

> **appendChild**(`child`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `child`   | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### appendText()

> **appendText**(`value`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### createBlobImage()

> **createBlobImage**(`callback`): [`BlobImageComponent`](#blobimagecomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`BlobImageComponent`](#blobimagecomponent)

##### createDiv()

> **createDiv**(`options?`, `callback`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `options`  | \{ \} |
| `callback` | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### createEl()

> **createEl**(`tag`, `options?`, `callback`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `tag`      | `any` |
| `options`  | \{ \} |
| `callback` | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### createIcon()

> **createIcon**(`callback`): [`IconComponent`](#iconcomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`IconComponent`](#iconcomponent)

##### createPostsFeed()

> **createPostsFeed**(`callback`): [`PostsFeedComponent`](#postsfeedcomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`PostsFeedComponent`](#postsfeedcomponent)

##### createProfilesList()

> **createProfilesList**(`callback`): [`ProfilesListComponent`](#profileslistcomponent)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `callback` | `any` |

###### Returns

[`ProfilesListComponent`](#profileslistcomponent)

##### createSpan()

> **createSpan**(`options?`, `callback`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter  | Type  |
| ---------- | ----- |
| `options`  | \{ \} |
| `callback` | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### createText()

> **createText**(`value`): [`VirtualText`](#virtualtext)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`VirtualText`](#virtualtext)

##### empty()

> **empty**(): [`VirtualEl`](#virtualel)

###### Returns

[`VirtualEl`](#virtualel)

##### onChange()

> **onChange**(`fn`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `fn`      | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### onClick()

> **onClick**(`fn`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `fn`      | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### onInput()

> **onInput**(`fn`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `fn`      | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### setAttr()

> **setAttr**(`name`, `value`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `name`    | `any` |
| `value`   | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### setStyle()

> **setStyle**(`name`, `value`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `name`    | `any` |
| `value`   | `any` |

###### Returns

[`VirtualEl`](#virtualel)

##### setText()

> **setText**(`text`): [`VirtualEl`](#virtualel)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `text`    | `any` |

###### Returns

[`VirtualEl`](#virtualel)

---

### VirtualText

#### Constructors

##### Constructor

> **new VirtualText**(`value`): [`VirtualText`](#virtualtext)

###### Parameters

| Parameter | Type  |
| --------- | ----- |
| `value`   | `any` |

###### Returns

[`VirtualText`](#virtualtext)

#### Properties

| Property                            | Type     |
| ----------------------------------- | -------- |
| <a id="property-value"></a> `value` | `string` |

## Functions

### fetch()

> **fetch**(`url`, `init?`): `Promise`\<[`PluginResponse`](#pluginresponse)\>

#### Parameters

| Parameter | Type  |
| --------- | ----- |
| `url`     | `any` |
| `init`    | \{ \} |

#### Returns

`Promise`\<[`PluginResponse`](#pluginresponse)\>

---

### flattenForScan()

> **flattenForScan**(`tokens`): [`FlattenedTokens`](#flattenedtokens)

#### Parameters

| Parameter | Type  |
| --------- | ----- |
| `tokens`  | `any` |

#### Returns

[`FlattenedTokens`](#flattenedtokens)
