
        const searchParams = new URLSearchParams(window.location.search);
        const elements = {
            obsUrl: document.getElementById('obsUrl'),
            obsPassword: document.getElementById('obsPassword'),
            connectionStatus: document.getElementById('connectionStatus'),
            sceneName: document.getElementById('sceneName'),
            sourceName: document.getElementById('sourceName'),
            groupName: document.getElementById('groupName'),
            filterName: document.getElementById('filterName'),
            inputName: document.getElementById('inputName'),
            requestType: document.getElementById('requestType'),
            requestPayload: document.getElementById('requestPayload'),
            logOutput: document.getElementById('logOutput')
        };

        let obs = null;

        function getCompatibilityHint(url) {
            const hints = [];
            if (String(url || '').includes(':4444')) {
                hints.push('Port 4444 usually indicates obs-websocket 4.x. This tester expects the v5 API from OBS 28+.');
            }
            if (window.location.protocol === 'https:' && /^ws:\/\//i.test(url || '')) {
                hints.push('Some browsers block ws:// from an https:// page.');
            }
            return hints.join(' ');
        }

        function setStatus(level, message) {
            elements.connectionStatus.className = `status ${level}`;
            elements.connectionStatus.textContent = message;
        }

        function log(message, data) {
            const timestamp = new Date().toLocaleTimeString();
            let line = `[${timestamp}] ${message}`;
            if (typeof data !== 'undefined') {
                try {
                    line += `\n${JSON.stringify(data, null, 2)}`;
                } catch (error) {
                    line += `\n${String(data)}`;
                }
            }

            elements.logOutput.textContent = `${line}\n\n${elements.logOutput.textContent}`;
        }

        function readPayload() {
            const raw = elements.requestPayload.value.trim();
            if (!raw) {
                return {};
            }
            return JSON.parse(raw);
        }

        async function connectOBS() {
            if (typeof OBSWebSocket === 'undefined') {
                setStatus('error', 'OBS WebSocket library not loaded.');
                log('OBS WebSocket library not loaded.');
                return null;
            }

            const url = elements.obsUrl.value.trim() || 'ws://127.0.0.1:4455';
            const password = elements.obsPassword.value;

            if (obs) {
                try {
                    await obs.disconnect();
                } catch (error) {
                    log('Previous OBS connection cleanup failed.', { error: error.message || String(error) });
                }
                obs = null;
            }

            setStatus('warn', `Connecting to ${url}...`);
            log(`Connecting to ${url}${password ? ' with password.' : ' without password.'}`);

            const client = new OBSWebSocket();
            client.on('ConnectionClosed', (error) => {
                const message = (error && error.message) || 'Connection closed';
                setStatus('warn', `Connection closed. ${message}`);
                log('OBS connection closed.', { error: message });
                if (obs === client) {
                    obs = null;
                }
            });
            client.on('ConnectionError', (error) => {
                const message = (error && error.message) || String(error);
                setStatus('error', `Connection error. ${message}`);
                log('OBS connection error.', { error: message });
            });

            try {
                const connectInfo = await client.connect(url, password || undefined);
                const version = await client.call('GetVersion');
                obs = client;
                setStatus(
                    'ok',
                    `Connected to ${url}. OBS ${version.obsVersion || 'unknown'}, WebSocket ${version.obsWebSocketVersion || connectInfo.obsWebSocketVersion || 'unknown'}, RPC ${connectInfo.negotiatedRpcVersion || connectInfo.rpcVersion || 'unknown'}.`
                );
                log('Connected to OBS.', {
                    url,
                    obsVersion: version.obsVersion || null,
                    obsWebSocketVersion: version.obsWebSocketVersion || connectInfo.obsWebSocketVersion || null,
                    rpcVersion: connectInfo.negotiatedRpcVersion || connectInfo.rpcVersion || null
                });
                if (getCompatibilityHint(url)) {
                    log('Compatibility note.', { hint: getCompatibilityHint(url) });
                }
                return client;
            } catch (error) {
                obs = null;
                const message = error && error.message ? error.message : String(error);
                setStatus('error', `Failed to connect. ${message}`);
                log('OBS connection failed.', {
                    url,
                    error: message,
                    hint: getCompatibilityHint(url)
                });
                return null;
            }
        }

        async function ensureOBS() {
            if (obs) {
                return obs;
            }
            return connectOBS();
        }

        async function disconnectOBS() {
            if (!obs) {
                setStatus('idle', 'No OBS WebSocket connection is active.');
                log('Disconnect requested with no active OBS connection.');
                return;
            }

            try {
                await obs.disconnect();
                setStatus('idle', 'Disconnected from OBS WebSocket.');
                log('Disconnected from OBS.');
            } catch (error) {
                setStatus('error', `Disconnect failed. ${error.message || String(error)}`);
                log('OBS disconnect failed.', { error: error.message || String(error) });
            } finally {
                obs = null;
            }
        }

        async function callOBS(requestType, requestData = {}) {
            const client = await ensureOBS();
            if (!client) {
                throw new Error('OBS WebSocket is not connected.');
            }

            const response = await client.call(requestType, requestData);
            log(`OBS request succeeded: ${requestType}`, {
                requestData,
                response
            });
            return response;
        }

        async function resolveInputByName(inputName) {
            if (!inputName) {
                return null;
            }

            const inputList = await callOBS('GetInputList');
            return (inputList.inputs || []).find((input) => input.inputName === inputName) || null;
        }

        async function runDiagnostics() {
            try {
                const version = await callOBS('GetVersion');
                const currentScene = await callOBS('GetCurrentProgramScene');
                const sceneList = await callOBS('GetSceneList');
                log('Diagnostics complete.', {
                    obsVersion: version.obsVersion || null,
                    currentProgramSceneName: currentScene.currentProgramSceneName || null,
                    sceneCount: Array.isArray(sceneList.scenes) ? sceneList.scenes.length : null
                });
            } catch (error) {
                log('Diagnostics failed.', { error: error.message || String(error) });
            }
        }

        async function changeScene() {
            const sceneName = elements.sceneName.value.trim();
            if (!sceneName) {
                log('Scene name is required for Change Scene.');
                return;
            }
            await callOBS('SetCurrentProgramScene', { sceneName });
        }

        async function toggleSource() {
            const sourceName = elements.sourceName.value.trim();
            if (!sourceName) {
                log('Source name is required for Toggle Source.');
                return;
            }

            const groupName = elements.groupName.value.trim();
            let sceneName = groupName || elements.sceneName.value.trim();
            if (!sceneName) {
                const currentScene = await callOBS('GetCurrentProgramScene');
                sceneName = currentScene.currentProgramSceneName;
            }
            const item = await callOBS('GetSceneItemId', { sceneName, sourceName });
            const currentState = await callOBS('GetSceneItemEnabled', {
                sceneName,
                sceneItemId: item.sceneItemId
            });

            await callOBS('SetSceneItemEnabled', {
                sceneName,
                sceneItemId: item.sceneItemId,
                sceneItemEnabled: !currentState.sceneItemEnabled
            });
        }

        async function toggleFilter() {
            const sourceName = elements.sourceName.value.trim();
            const filterName = elements.filterName.value.trim();
            if (!sourceName || !filterName) {
                log('Source name and filter name are required for Toggle Filter.');
                return;
            }

            const inputRef = await resolveInputByName(sourceName);
            const filterTarget = inputRef && inputRef.inputUuid
                ? { sourceUuid: inputRef.inputUuid }
                : { sourceName };

            const currentState = await callOBS('GetSourceFilter', Object.assign({}, filterTarget, { filterName }));
            await callOBS('SetSourceFilterEnabled', Object.assign({}, filterTarget, {
                filterName,
                filterEnabled: !currentState.filterEnabled
            }));
        }

        async function toggleMute() {
            const inputName = elements.inputName.value.trim();
            if (!inputName) {
                log('Audio input name is required for Toggle Mute.');
                return;
            }

            const inputRef = await resolveInputByName(inputName);
            const inputTarget = inputRef && inputRef.inputUuid
                ? { inputUuid: inputRef.inputUuid }
                : { inputName };

            const currentState = await callOBS('GetInputMute', inputTarget);
            await callOBS('SetInputMute', Object.assign({}, inputTarget, {
                inputMuted: !currentState.inputMuted
            }));
        }

        function bindButton(id, handler) {
            document.getElementById(id).addEventListener('click', async () => {
                try {
                    await handler();
                } catch (error) {
                    log(`Action failed: ${id}`, { error: error.message || String(error) });
                }
            });
        }

        bindButton('connectButton', connectOBS);
        bindButton('disconnectButton', disconnectOBS);
        bindButton('diagnosticsButton', runDiagnostics);
        bindButton('getVersionButton', () => callOBS('GetVersion'));
        bindButton('currentSceneButton', () => callOBS('GetCurrentProgramScene'));
        bindButton('sceneListButton', () => callOBS('GetSceneList'));
        bindButton('changeSceneButton', changeScene);
        bindButton('toggleSourceButton', toggleSource);
        bindButton('toggleFilterButton', toggleFilter);
        bindButton('toggleMuteButton', toggleMute);
        bindButton('startRecordButton', () => callOBS('StartRecord'));
        bindButton('stopRecordButton', () => callOBS('StopRecord'));
        bindButton('startStreamButton', () => callOBS('StartStream'));
        bindButton('stopStreamButton', () => callOBS('StopStream'));
        bindButton('saveReplayButton', () => callOBS('SaveReplayBuffer'));
        bindButton('runRequestButton', async () => {
            const requestType = elements.requestType.value.trim();
            if (!requestType) {
                log('Request type is required.');
                return;
            }

            const requestData = readPayload();
            await callOBS(requestType, requestData);
        });

        elements.obsUrl.value = searchParams.get('obsws') || searchParams.get('obswebsocket') || 'ws://127.0.0.1:4455';
        elements.obsPassword.value = searchParams.get('obspw') || searchParams.get('obspassword') || '';

        if (searchParams.get('autoconnect') === '1') {
            connectOBS();
        }
    