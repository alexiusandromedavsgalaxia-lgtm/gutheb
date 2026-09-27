# GUT Protocol

GutHeb uses its own native **GUT** protocol. It does not require Git transport.

## Commands

```text
gut pash -g clone archive <archive>
gut pash -g create archive <archive> -& pash directory ./<carpet>
gut clone -<repo>
gut delete -<repo|archivo|raw|codespace|action|carpeta> <target>
```

The protocol endpoint is `/api/gut` and accepts JSON POST requests with a `command` field. Requests use the authenticated GutHeb session.

### Operations

- **clone** returns the repository snapshot, files, folders and GUT/1 metadata.
- **create archive** stores a GUT archive containing the selected repository directory.
- **clone archive** retrieves a stored GUT archive.
- **delete -repo** removes the repository and its stored files/folders.
- **delete -archivo** removes one repository file.
- **delete -raw** removes one raw repository file target.
- **delete -carpeta** removes a folder and all descendants.
- **delete -codespace** removes a stored GutHeb Codespace record.
- **delete -action** removes a Marketplace Action only when the authenticated user owns it.

For file/folder/raw deletion, send the repository in the request body as `repo`. Archive creation also accepts `repo` to select the source repository.

Archive format is JSON with `format: "GUT-ARCHIVE"`, `version: 1`, repository metadata, files and folders.
