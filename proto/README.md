# Proto Directory

Store FBE `.proto` definitions and generated JavaScript in this directory.

- Source proto files can live anywhere under `/proto`
- Generated JavaScript should be written to `/proto/js`
- Both the backend and frontend Docker images copy `/proto` during build
- The development compose stack mounts `/proto` directly for live updates

Current backend files:

- `/proto/chat.fbe` contains the shared chat envelope schema
- `/proto/js/fbe-chat-model.js` contains the JavaScript FBE codec used by the backend
