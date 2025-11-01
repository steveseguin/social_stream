// filename: ai.js
// this file depends on background.js
// this file contains the LLM / RAG component

let globalLunrIndex = null;
let documentsRAG = []; // Store all documents here
const LunrDBLLM = "LunrDBLLM";
const LUNR_DOCUMENT_STORE_NAME = 'documents';
const activeProcessing = {};
const uploadQueue = [];
let isUploading = false;
let lunrIndexPromise;
const maxContextSize = 31000;
const maxContextSizeFull = 32000;

class LLMServiceError extends Error {
    constructor(details = {}) {
        const message = details.message || 'LLM request failed';
        super(message);
        this.name = 'LLMServiceError';
        this.provider = details.provider || 'unknown';
        this.status = details.status || null;
        this.code = details.code || null;
        this.model = details.model || null;
        this.endpoint = details.endpoint || null;
        this.hint = details.hint || null;
        this.details = details.details || null;
        this.reported = false;
    }
}

function getLLMHint(status, code) {
    if (status === 401 || status === 403) {
        return 'Verify that your API key is present and has permission to use this model.';
    }
    if (status === 404 || (code && String(code).toLowerCase().includes('not_found'))) {
        return 'Check the requested model name and endpoint URL.';
    }
    if (status === 402) {
        return 'The provider reports a billing or credits issue. Review your plan or balance.';
    }
    if (status === 429 || (code && String(code).toLowerCase().includes('rate'))) {
        return 'The provider rate limit was reached. Reduce frequency or increase your quota.';
    }
    if (status >= 500 && status < 600) {
        return 'The provider reported a server error. Try again shortly.';
    }
    return null;
}

function formatLLMErrorSummary(error) {
    const parts = [`[LLM:${error.provider}]`];
    if (error.model) {
        parts.push(`model="${error.model}"`);
    }
    if (error.status !== null && error.status !== undefined) {
        parts.push(`status=${error.status}`);
    }
    if (error.code) {
        parts.push(`code=${error.code}`);
    }
    const summary = `${parts.join(' ')} ${error.message}`.trim();
    return error.hint ? `${summary} — ${error.hint}` : summary;
}

function reportLLMError(error) {
    if (!error || error.reported) {
        return;
    }
    console.error(formatLLMErrorSummary(error));
    if (error.details) {
        try {
            console.error('[LLM:details]', error.details);
        } catch (e) {
            console.error('[LLM:details] Unable to log details payload');
        }
    }
    error.reported = true;
}

function createLLMError(baseDetails, extra = {}) {
    const merged = { ...baseDetails, ...extra };
    if (!merged.hint && (merged.status || merged.code)) {
        merged.hint = getLLMHint(merged.status, merged.code) || merged.hint;
    }
    const err = new LLMServiceError(merged);
    reportLLMError(err);
    return err;
}

function noteChatBotDecision(reason, data, context = {}) {
    try {
        if (!settings?.allowChatBot) {
            return;
        }
        const user = data?.chatname || data?.userid || 'unknown';
        const source = data?.type || 'unknown';
        const contextEntries = Object.entries(context)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => `${key}=${value}`);
        const message = [`[ChatBot] ${reason}`, `user=${user}`, `source=${source}`, ...contextEntries].join(' | ');
        console.log(message);
    } catch (e) {
        console.warn('Failed to log chat bot decision:', e);
    }
}

async function rebuildIndex() {
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    const allDocs = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });

    const documents = [];
    allDocs.forEach(doc => {
        if (doc.chunks) {
            doc.chunks.forEach((chunk, index) => {
                documents.push({
                    id: `${doc.id}_${index}`, // Use doc.id instead of doc.id
                    title: chunk.title,
                    content: chunk.content,
                    summary: chunk.summary,
                    tags: chunk.tags.join(' '),
                    synonyms: chunk.synonyms.join(' '),
                    level: chunk.level
                });
            });
        } else {
            documents.push({
                id: doc.id, // Use doc.id
                title: doc.title,
                content: doc.content,
                summary: doc.overallSummary,
                tags: doc.tags ? doc.tags.join(' ') : '',
                synonyms: doc.synonyms ? doc.synonyms.join(' ') : ''
            });
        }
    });

    globalLunrIndex = initLunrIndex(documents);
}

async function getFirstAvailableModel(exclude=null) {
    let ollamaendpoint = settings.ollamaendpoint?.textsetting || "http://localhost:11434";
    
    const isLLMModel = (model) => {
        const llmFamilies = ['llama', 'qwen2'];
        return model.details?.families?.some(family => llmFamilies.includes(family));
    };
    
    const getSizeInBillions = (model) => {
        const sizeStr = model.details?.parameter_size;
        return parseFloat(sizeStr?.replace('B', '')) || 0;
    };
    
    const findBestModel = (models) => {
        const llmModels = models.filter(isLLMModel);
        if (!llmModels.length) return models[0]?.name;
        
        const targetModels = llmModels.filter(m => {
            const size = getSizeInBillions(m);
            return size >= 2 && size <= 8;
        });
        
        if (targetModels.length) {
            const model = targetModels[0].name !== exclude ? 
                targetModels[0] : targetModels[1] || targetModels[0];
            return model.name;
        }
        
        const sizes = llmModels.map(m => ({
            model: m,
            size: getSizeInBillions(m),
            diff: Math.min(
                Math.abs(getSizeInBillions(m) - 2),
                Math.abs(getSizeInBillions(m) - 8)
            )
        }));
        
        const closest = sizes.sort((a, b) => a.diff - b.diff)[0];
        return closest.model.name;
    };

    if (typeof ipcRenderer !== 'undefined') {
        return new Promise(async (resolve, reject) => {
            let ccc = setTimeout(() => reject(new Error('Request timed out')), 10000);
            try {
                const xhr = await fetchNode(`${ollamaendpoint}/api/tags`);
                clearTimeout(ccc);
                const datar = JSON.parse(xhr.data);
                if (!datar?.models?.length) {
                    throw createLLMError({
                        provider: 'ollama',
                        endpoint: ollamaendpoint,
                        status: 404,
                        code: 'model_not_found',
                        message: 'Ollama did not return any models at the configured endpoint.'
                    });
                }
                resolve(findBestModel(datar.models));
            } catch(e) {
                clearTimeout(ccc);
                reject(e);
            }
        });
    }
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${ollamaendpoint}/api/tags`, true);
        xhr.timeout = 10000;
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const datar = JSON.parse(xhr.responseText);
                if (!datar?.models?.length) {
                    reject(new Error('No models available'));
                    return;
                }
                resolve(findBestModel(datar.models));
            } else {
                reject(new Error('Failed to fetch models'));
            }
        };
        
        xhr.ontimeout = () => reject(new Error('Request timed out'));
        xhr.onerror = () => reject(new Error('Network error while fetching models'));
        xhr.send();
    });
}


const streamingPostNode = async function (URL, body, headers = {}, onChunk = null, signal = null) {
	if (ipcRenderer){
		return new Promise((resolve, reject) => {
			const channelId = `stream-${Date.now()}-${Math.random()}`;
			
			let fullResponse = '';
			
			const cleanup = () => {
				ipcRenderer.removeAllListeners(channelId);
				ipcRenderer.send(`${channelId}-close`);
			};
			
			ipcRenderer.on(channelId, (event, chunk) => {
				if (chunk === null) {
					// Stream ended
					cleanup();
					resolve(fullResponse);
				} else {
					fullResponse += chunk;
					if (onChunk) onChunk(chunk);
				}
			});
			
			ipcRenderer.send("streaming-nodepost", {
				channelId,
				url: URL,
				body: body,
				headers: headers
			});
			
			if (signal) {
				signal.addEventListener('abort', () => {
					cleanup();
					ipcRenderer.send(`${channelId}-abort`);
					reject(new DOMException('Aborted', 'AbortError'));
				});
			}
		});
	}
};

function signAWSRequest(method, url, headers, body, accessKey, secretKey, region, service = 'bedrock') {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    
    // Add required headers
    headers['x-amz-date'] = timestamp;
    
    // If content-type is not already set
    if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
    }
    
    // Parse URL
    const parsedUrl = new URL(url);
    const canonicalUri = parsedUrl.pathname || '/';
    
    // Create canonical request
    const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key.toLowerCase()}:${headers[key].trim()}\n`)
        .join('');
    
    const signedHeaders = Object.keys(headers)
        .sort()
        .map(key => key.toLowerCase())
        .join(';');
    
    // Create canonical query string
    const searchParams = parsedUrl.searchParams;
    const canonicalQueryString = Array.from(searchParams.keys())
        .sort()
        .map(key => {
            return `${encodeURIComponent(key)}=${encodeURIComponent(searchParams.get(key))}`;
        })
        .join('&');
    
    // Create payload hash
    let payloadHash;
    if (typeof body === 'string') {
        payloadHash = sha256(body);
    } else if (body) {
        payloadHash = sha256(JSON.stringify(body));
    } else {
        payloadHash = sha256('');
    }
    
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');
    
    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const scope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        timestamp,
        scope,
        sha256(canonicalRequest)
    ].join('\n');
    
    // Calculate signature
    function hmac(key, string) {
        const hmacObj = crypto.createHmac('sha256', key);
        hmacObj.update(string);
        return hmacObj.digest();
    }
    
    let signingKey = 'AWS4' + secretKey;
    signingKey = hmac(signingKey, date);
    signingKey = hmac(signingKey, region);
    signingKey = hmac(signingKey, service);
    signingKey = hmac(signingKey, 'aws4_request');
    
    const signature = hmacToHex(hmac(signingKey, stringToSign));
    
    // Add the signature to the headers
    headers['Authorization'] = `${algorithm} Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return headers;
}

function sha256(message) {
    if (crypto) {
        return crypto.createHash('sha256').update(message).digest('hex');
    } else if (window.crypto && window.crypto.subtle) {
        // For browser environments
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        return window.crypto.subtle.digest('SHA-256', data)
            .then(hash => {
                return Array.from(new Uint8Array(hash))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            });
    }
}

function hmacToHex(hmacBuffer) {
    return Array.prototype.map.call(new Uint8Array(hmacBuffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

const activeChatBotSessions = {};
let tmpModelFallback = "";
async function callLLMAPI(prompt, model = null, callback = null, abortController = null, UUID = null, images = null) {
	
	const provider = settings.aiProvider?.optionsetting || "ollama";
	let endpoint, apiKey, streamable;

	const buildContext = () => ({
		provider,
		model,
		endpoint
	});

	const wrapLLMError = (error, extra = {}) => {
		if (error instanceof LLMServiceError) {
			reportLLMError(error);
			return error;
		}
		const merged = {
			...buildContext(),
			details: error,
			message: error?.message || extra.message || 'LLM request failed'
		};
		return createLLMError(merged, extra);
	};

	switch (provider) {
		case "ollama":
			endpoint = settings.ollamaendpoint?.textsetting || "http://localhost:11434";
			model = model || settings.ollamamodel?.textsetting || tmpModelFallback || null;
			break;
		case "chatgpt":
			endpoint = "https://api.openai.com/v1/chat/completions";
			model = model || settings.chatgptmodel?.textsetting || "gpt-4o-mini";
			apiKey = settings.chatgptApiKey?.textsetting;
			callback = null;
			break;
		case "deepseek":
			endpoint = "https://api.deepseek.com/v1/chat/completions";
			model = model || settings.deepseekmodel?.textsetting || "deepseek-chat";
			apiKey = settings.deepseekApiKey?.textsetting;
			callback = null;
			break;
		case "gemini":
			endpoint = "https://generativelanguage.googleapis.com/v1beta/chat/completions";
			model = model || settings.geminimodel?.textsetting || "gemini-2.0-flash";
			apiKey = settings.geminiApiKey?.textsetting;
			callback = null;
			break;
		case "xai":  // New case for Grok
			endpoint = "https://api.x.ai/v1/chat/completions";
			model = model || settings.xaimodel?.textsetting || "grok-beta";  // Default to grok-beta
			apiKey = settings.xaiApiKey?.textsetting;  // Requires an API key from xAI
			// streamable = true;  // Grok supports streaming
			callback = null;
			break;
		case "bedrock":
			endpoint = `https://bedrock-runtime.${settings.bedrockRegion?.textsetting || "us-east-1"}.amazonaws.com/model`;
			model = model || settings.bedrockmodel?.textsetting || "anthropic.claude-3-sonnet-20240229-v1:0";
			apiKey = settings.bedrockAccessKey?.textsetting;
			const secretKey = settings.bedrockSecretKey?.textsetting;
			const region = settings.bedrockRegion?.textsetting || "us-east-1";
			callback = null; // TODO: Implement streaming for Bedrock if desired
			break;
		case "openrouter":
			endpoint = "https://openrouter.ai/api/v1/chat/completions";
			model = model || settings.openroutermodel?.textsetting || "openai/gpt-4o";
			apiKey = settings.openrouterApiKey?.textsetting;
			callback = null;
			break;
		case "groq":
			endpoint = "https://api.groq.com/openai/v1/chat/completions";
			model = model || settings.groqmodel?.textsetting || "llama-3.1-8b-instant";
			apiKey = settings.groqApiKey?.textsetting;
			break;
		case "custom":
			endpoint = settings.customAIEndpoint?.textsetting || "http://localhost:11434";
			if (!endpoint.includes("/v1") || !endpoint.includes("/completions")){ // going to assume you already ended the completions URL
				endpoint = endpoint.replace(/\/+$/, '') + "/v1/chat/completions"
			}
			model = model || settings.customAIModel?.textsetting || "";
			apiKey = settings.customAIApiKey?.textsetting;
			//callback = null;
			break;
		case "default":
			endpoint = "http://localhost:11434";
			apiKey = "";
			model = model || "";
			callback = null;
			break;
	}
		
	function handleChunk(chunk, callback, appendToFull, reasoning=false) {
		const lines = chunk.split('\n').filter(line => line.trim());
		for (const line of lines) {
			if (line.trim() === 'data: [DONE]') {
				return true;
			}
			if (line) {
				try {
					const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
					const data = JSON.parse(jsonStr);
					
					if (data.response) { // Ollama format
						appendToFull(data.response);
						if (callback) callback(data.response);
					} else if (data.choices?.[0]?.delta?.content) { // ChatGPT/Gemini format
						const content = data.choices[0].delta.content;
						if (content) {
							appendToFull(content);
							if (callback) callback(content);
						}
					} else if (data.choices?.[0]?.delta?.reasoning_content) { // LMStudio format
						const content = data.choices[0].delta.reasoning_content;
						if (content) {
							appendToFull(content);
							if (callback) callback(content, true);
						}
					} else if (data.candidates?.[0]?.content?.parts?.[0]?.text) { // Legacy Gemini format
						appendToFull(data.candidates[0].content.parts[0].text);
						if (callback) callback(data.candidates[0].content.parts[0].text);
					}
					
					if (data.choices?.[0]?.finish_reason === "stop" || data.done) {
						return true;
					}
				} catch (e) {
					console.warn("Parse error:", e, line);
					const match = line.match(/"response":"(.*?)"/);
					if (match && match[1]) {
						const extractedResponse = match[1];
						appendToFull(extractedResponse);
						if (callback) callback(extractedResponse);
					}
				}
			}
		}
		return false;
	}
	
    if (provider === "ollama") {
		
        let ollamamodel = model;
        if (!ollamamodel) {
            ollamamodel = await getFirstAvailableModel();
            if (ollamamodel) {
                tmpModelFallback = ollamamodel;
                setTimeout(() => {
                    tmpModelFallback = ""; 
                }, 60000);
            } else {
                throw createLLMError(buildContext(), {
                    status: 404,
                    code: 'model_not_found',
                    message: 'No Ollama models are available on the configured endpoint.'
                });
            }
        }
        model = ollamamodel;

        const result = await makeRequestToOllama(ollamamodel);
        if (result.aborted) {
            return result.response + "💥";
        } else if (result.error && result.error === 404) {
            try {
                const availableModel = await getFirstAvailableModel(ollamamodel);
                if (availableModel) {
                    console.log(`[LLM:ollama] Model "${ollamamodel}" not found. Falling back to "${availableModel}".`);
                    tmpModelFallback = availableModel;
                    setTimeout(() => {
                        tmpModelFallback = ""; 
                    }, 60000);
                    model = availableModel;
                    const fallbackResult = await makeRequestToOllama(availableModel);
                    if (fallbackResult.aborted) {
                        return fallbackResult.response + "💥";
                    } else if (fallbackResult.error) {
                        throw createLLMError(buildContext(), {
                            status: fallbackResult.status || fallbackResult.error || null,
                            code: fallbackResult.code || 'model_error',
                            message: fallbackResult.message || 'Fallback Ollama model returned an error.',
                            details: fallbackResult
                        });
                    }
                    return fallbackResult.complete ? fallbackResult.response : fallbackResult.response + "💥";
                } else {
                    throw createLLMError(buildContext(), {
                        status: 404,
                        code: 'model_not_found',
                        message: `Ollama model "${ollamamodel}" not found and no fallback model is available.`
                    });
                }
            } catch (fallbackError) {
                throw wrapLLMError(fallbackError, {
                    message: fallbackError?.message || 'Fallback Ollama request failed.'
                });
            }
        } else if (result.error) {
            throw createLLMError(buildContext(), {
                status: result.status || result.error || null,
                code: result.code || 'ollama_error',
                message: result.message || 'Ollama returned an error response.',
                details: result
            });
        }
        return result.complete ? result.response : result.response + "💥";
	} else if (provider === "bedrock") {
		try {
			const modelId = model;
			model = modelId;
			const bedrockEndpoint = `${endpoint}/${modelId}/invoke`;
			
			let requestBody;
			
			// Format the request body based on the model (anthropic, amazon, etc.)
			if (modelId.includes('anthropic')) {
				requestBody = {
					anthropic_version: "bedrock-2023-05-31",
					max_tokens: 4096,
					messages: [
						{
							role: "user",
							content: prompt
						}
					]
				};
			} else if (modelId.includes('amazon')) {
				requestBody = {
					inputText: prompt,
					textGenerationConfig: {
						maxTokenCount: 4096,
						stopSequences: [],
						temperature: 0.7,
						topP: 0.9
					}
				};
			} else if (modelId.includes('cohere')) {
				requestBody = {
					prompt: prompt,
					max_tokens: 4096,
					temperature: 0.7,
					p: 0.9
				};
			} else {
				// Default format (try Claude style)
				requestBody = {
					prompt: prompt,
					max_tokens_to_sample: 4096
				};
			}
			
			// Create headers with AWS signature
			const headers = {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			};
			
			// Sign the request
			const signedHeaders = signAWSRequest(
				'POST', 
				bedrockEndpoint, 
				headers, 
				requestBody, 
				apiKey, 
				secretKey, 
				region, 
				'bedrock'
			);
			
			if (typeof ipcRenderer !== 'undefined') {
				const response = await fetchNode(bedrockEndpoint, signedHeaders, 'POST', requestBody);
				
				if (response.status !== 200) {
					let errorMessage = '';
					let errorData = null;
					try {
						errorData = JSON.parse(response.data);
						errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
					} catch(e) {
						errorMessage = `HTTP error! status: ${response.status}`;
					}
					throw createLLMError(buildContext(), {
						status: response.status,
						code: errorData?.code || errorData?.errorCode || errorData?.error?.code || null,
						message: errorMessage,
						details: errorData || response.data
					});
				}
				
				const data = JSON.parse(response.data);
				
				// Extract the response based on model
				if (modelId.includes('anthropic')) {
					return data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
				} else if (modelId.includes('amazon')) {
					return data.results && data.results[0] && data.results[0].outputText ? data.results[0].outputText : '';
				} else if (modelId.includes('cohere')) {
					return data.generations && data.generations[0] && data.generations[0].text ? data.generations[0].text : '';
				} else {
					return data.completion || '';
				}
			} else {
				const response = await fetch(bedrockEndpoint, {
					method: 'POST',
					headers: signedHeaders,
					body: JSON.stringify(requestBody),
					signal: abortController?.signal
				});
				
				if (!response.ok) {
					let errorMessage = '';
					let errorData = null;
					try {
						errorData = await response.json();
						errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
					} catch(e) {
						errorMessage = `HTTP error! status: ${response.status}`;
					}
					throw createLLMError(buildContext(), {
						status: response.status,
						code: errorData?.code || errorData?.errorCode || errorData?.error?.code || null,
						message: errorMessage,
						details: errorData
					});
				}
				
				const data = await response.json();
				
				// Extract the response based on model
				if (modelId.includes('anthropic')) {
					return data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
				} else if (modelId.includes('amazon')) {
					return data.results && data.results[0] && data.results[0].outputText ? data.results[0].outputText : '';
				} else if (modelId.includes('cohere')) {
					return data.generations && data.generations[0] && data.generations[0].text ? data.generations[0].text : '';
				} else {
					return data.completion || '';
				}
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				return { aborted: true };
			}
			throw wrapLLMError(error);
		}
    // Replace the else block in callLLMAPI with:
	} else { // non-Ollama Request, but rather ChatGPT compatible APIs
		const message = {
			model: model,
			messages: [{
				role: "user",
				content: prompt
			}],
			stream: callback !== null
		};

		const headers = {
			'Content-Type': 'application/json'
		};

		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		try {
			if (typeof ipcRenderer !== 'undefined') {
				if (callback) {
					return new Promise((resolve, reject) => {
						const channelId = `streaming-nodepost-${Date.now()}`;
						let fullResponse = '';
						
						ipcRenderer.on(channelId, (event, chunk) => {
							if (chunk === null) {
								resolve(fullResponse);
							} else if (typeof chunk === 'object' && chunk.error) {
								const err = createLLMError(buildContext(), {
									status: chunk.status || chunk.error?.status || null,
									code: chunk.code || chunk.error?.code || null,
									message: chunk.message || chunk.error?.message || 'Streaming response returned an error.',
									details: chunk
								});
								reject(err);
							} else {
								handleChunk(chunk, callback, (resp) => { 
									fullResponse += resp; 
								});
							}
						});

						ipcRenderer.send('streaming-nodepost', {
							channelId,
							url: endpoint,
							body: message,
							headers
						});

						if (abortController) {
							abortController.signal.addEventListener('abort', () => {
								ipcRenderer.send(`${channelId}-abort`);
							});
						}
					});
				} else {
					const response = await fetchNode(endpoint, headers, 'POST', message);
					
					if (response.status !== 200) {
						let errorMessage = '';
						let errorData = null;
						try {
							errorData = JSON.parse(response.data);
							errorMessage = errorData.error?.message || errorData.message || `HTTP error! status: ${response.status}`;
						} catch(e) {
							errorMessage = `HTTP error! status: ${response.status}`;
						}
						throw createLLMError(buildContext(), {
							status: response.status,
							code: errorData?.error?.code || errorData?.error?.type || errorData?.code || null,
							message: errorMessage,
							details: errorData || response.data
						});
					}

					const data = JSON.parse(response.data);
					return data.choices[0].message.content;
				}
			} else {
				if (callback) {
					const response = await fetch(endpoint, {
						method: 'POST',
						headers,
						body: JSON.stringify(message),
						signal: abortController?.signal
					});

					if (!response.ok) {
						let errorPayload = null;
						let errorMessage = `HTTP error! status: ${response.status}`;
						try {
							errorPayload = await response.json();
							errorMessage = errorPayload.error?.message || errorPayload.message || errorMessage;
						} catch(e) {
							// ignore parse issue; keep default message
						}
						throw createLLMError(buildContext(), {
							status: response.status,
							code: errorPayload?.error?.code || errorPayload?.error?.type || errorPayload?.code || null,
							message: errorMessage,
							details: errorPayload
						});
					}

					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let fullResponse = '';

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						
						const chunk = decoder.decode(value);
						const isComplete = handleChunk(chunk, callback, (resp) => { 
							fullResponse += resp; 
						});
						
						if (isComplete) break;
					}

					return fullResponse;
				} else {
					const response = await fetch(endpoint, {
						method: 'POST',
						headers,
						body: JSON.stringify(message),
						signal: abortController?.signal
					});

					if (!response.ok) {
						let errorMessage = '';
						let errorData = null;
						try {
							errorData = await response.json();
							errorMessage = errorData.error?.message || errorData.message || `HTTP error! status: ${response.status}`;
						} catch(e) {
							errorMessage = `HTTP error! status: ${response.status}`;
						}
						throw createLLMError(buildContext(), {
							status: response.status,
							code: errorData?.error?.code || errorData?.error?.type || errorData?.code || null,
							message: errorMessage,
							details: errorData
						});
					}

					const data = await response.json();
					return data.choices[0].message.content;
				}
			}
		} catch (error) {
			if (error.name === 'AbortError') {
				return { aborted: true };
			}
			throw wrapLLMError(error);
		}
	}

    async function makeRequestToOllama(currentModel) {  // ollama only api
        const isStreaming = callback !== null;
        let fullResponse = '';
        let responseComplete = false;

        try {
            if (UUID) {
                if (activeChatBotSessions[UUID]) {
                    activeChatBotSessions[UUID].abort();
                }
                if (!abortController) {
                    abortController = new AbortController();
                }
                activeChatBotSessions[UUID] = abortController;
            }

            let response;
			let responseComplete;
            if (typeof ipcRenderer !== 'undefined') {  // ollama still
                // Your existing Electron implementation
                if (isStreaming) {
                    response = await new Promise((resolve, reject) => {
                        const channelId = `streaming-nodepost-${Date.now()}`;
                        
                        ipcRenderer.on(channelId, (event, chunk) => {
                            if (chunk === null) {
                                responseComplete = true;
                                resolve({ ok: true });
                            } else if (typeof chunk === 'object' && chunk.error) {
                                resolve(chunk);
                            } else {
                                handleChunk(chunk, callback, (resp, reasoning=false) => { fullResponse += resp; }, reasoning=false);
                            }
                        });
                        
                        const message = {
                            model: currentModel,
                            prompt: prompt,
                            stream: true,
							keep_alive: settings.ollamaKeepAlive ?  parseInt(settings.ollamaKeepAlive.numbersetting)+"m" : "5m"
                        };
                        
                        if (images){
                            message.images = images;
                        }

                        ipcRenderer.send('streaming-nodepost', {
                            channelId,
                            url: `${endpoint}/api/generate`,
                            body: message,
                            headers: { 'Content-Type': 'application/json' }
                        });

                        abortController.signal.addEventListener('abort', () => {
                            ipcRenderer.send(`${channelId}-abort`);
                        });
                    });

                    if (response.error) {
                        return response;
                    }
                } else {
                    // Your existing non-streaming Electron implementation
                    const message = {
                        model: currentModel,
                        prompt: prompt,
                        stream: false
                    };
                    
                    if (images){
                        message.images = images;
                    }
                    
                    response = fetchNode(`${endpoint}/api/generate`, {
                        'Content-Type': 'application/json',
                    }, 'POST', message);
                    
                    if (response.status === 404) {
                        return { error: 404, message: `Model ${currentModel} not found` };
                    } else if (response.status !== 200) {
                        return { error: response.status, message: `HTTP error! status: ${response.status}` };
                    }

                    try {
                        const data = JSON.parse(response.data);
                        fullResponse = data.response;
                        responseComplete = true;
                    } catch (e) {
                        console.error("Error parsing JSON:", e);
                        return { error: true, message: "Error parsing response" };
                    }
                }
            } else { // ollama still
                // Your existing Web implementation
                const message = {
                    model: currentModel,
                    prompt: prompt,
                    stream: isStreaming,
					keep_alive: settings.ollamaKeepAlive ?  parseInt(settings.ollamaKeepAlive.numbersetting)+"m" : "5m"
                };
                
                if (images){
                    message.images = images;
                }
                
                response = await fetch(`${endpoint}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message),
                    signal: abortController ? abortController.signal : undefined,
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        return { error: 404, message: `Model ${currentModel} not found` };
                    } else if (response.status) {
                        return { error: response.status, message: `HTTP error! status: ${response.status}` };
                    }
                    return {
                        error: true,
                        message: `HTTP error! status: ${response.status}`,
                        status: response.status || null
                    };
                }

                if (isStreaming) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            responseComplete = true;
                            break;
                        }
                        const chunk = decoder.decode(value);
                        handleChunk(chunk, callback, (resp, reasoning=false) => { fullResponse += resp; }, reasoning=false);
                    }
                } else {
                    const data = await response.json();
                    fullResponse = data.response;
                    responseComplete = true;
                }
            }
            
            return { success: true, response: fullResponse, complete: responseComplete };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { aborted: true, response: fullResponse };
            }
            return {
                error: true,
                message: error?.message || 'Ollama request failed.',
                status: error?.status || null,
                code: error?.code || null,
                details: error
            };
        } finally {
            if (UUID && activeChatBotSessions[UUID] === abortController) {
                delete activeChatBotSessions[UUID];
            }
        }
    }
}

// strip emotes
// if longer than 32-character, check it with AI

/* let badList = new Set(['🍆', '💩', '🖕', '👉👌', '🍑', '🤬', '🔞', 'fuck', 'sexy']);
function containsBadContent(message) {
  const words = message.toLowerCase().split(/\s+/);
  return words.some(word => badList.has(word)) || 
         Array.from(message).some(char => badList.has(char));
} */

let safePhrasesSet = new Set(["lmfao","uuh","lmao","lol","gg","ww","wow","caught","huh","ben","cap","ta","hi","oooo","rt","no","damn","lmaooo","lmfao 󠀀","what","ez","hah","yes","???","pffttt","omg","noway","lmaoooo","ewww","o7","saj","hiii","omegalul","ofc","..","lmfaooo","????","ew","ggs","herehego","ome44","xdd","??","lmfaoooo","lmaoo","capping","lmaoooooooooo","www","hello","gay","10","wwww","hii","lmaooooo","mhm","?????","wwwww","ok","kekw","lmfaooooo","lmfaoo","yo","ayy","pog","...","hahaha","bro","gigachad","cmb","nice","icant","do it","arky","oh","banger","hey","clap","??????","ww arky","dorkin","ja","holy","lmfaoooooo","???????","bye","klat","oh nah","1 of 1","zyzzbass","wwwwww","no way","ww 5","monka","lmaoooooo","aura","-10k","true","uuh 󠀀","hahahaha","o wow","bruh","mmmmm","nah","me","hmm","rip","mmmmmm","haha","nooo","life","lmfaooooooo","xd","piece","buh","5.5","classic","real voice","frenn","noooo","????????","ayo","same","󠀀","ra","guuh","ono","man of meat","aaaa","ewwww","yamfam","letsgo","derp","yeah","ego","eww","yep","wwwwwww","mmmmmmm","mmmm","cinema","yooo","gayge","uhh","cungus","piece blash","?????????","stfu","pa","ww method","piece lotus","oh no","wicked","exit","ginji","dtm","lmaooooooo","nt","meat7","ayaya","widespeedlaugh","uuh uuh","chip","cringe","hahahahaha",":)","back","mmmmmmmm","danse","ogre","hesright","w arky","fax","what a save","its real","necco","ff","here we go","poll is uppppp","a u r a","d:","yoooo","men","mmmmmmmmm","gachademon","mmmmmmmmmm","oof","wwwwwwww","wwwwwwwww","catjam","o nah","okay","fr","??????????","idiot","ww emp","hahahah","ome5","mogged","lets goooo","yesss","ewwwww","nooooo","om","mmmmmmmmmmm","looking","real","hiiii","go","brb","yoo","hesgay","lmfao lmfao","lmfaoooooooo","lets go","....","sign bob","stop","acha","ll","lmao 󠀀","man of crabs","lmaoooooooo","ome","cucked","lmfaooooooooo","lets gooo","crazy","kek","ww 󠀀","ddl","meow","orange","وعليكم السلام","dicktone","oooo 󠀀","lmfaoooooooooo","rockn","20","yea","good","tarky","tuuh","memegym","sus","woah","we good","hello everyone","tf","ww deshae","ww segment","11","hmmm","loool","whattt","hola","sold","ww ww","lmfaooooooooooo","w method","yup","hit","السلام عليكم","uhhh","wwwwwwwwwww","nahhh","ta ta","ww unc","lacy","ot","lmaooooooooo","herehego 󠀀","predify","ww max","100","nope","based","goat","noooooo","press 1","stand","ww cap","dam","shiza","glaze","idk","???????????","smh","sakina","hiiiii","yay","سلام","na","xa","f a t","w 5","oh wow","bds","thanks","facts","uhoh","how","finally","byee","refresh","????????????","sped","sheesh","stare","exactly","damnnn","nahhhh","yess","wwwwwwwwww","ww 50","hah hah","sweater","why","who","thats crazy","hahah","lelw","oh shit","w raid","listening","team","caught 󠀀","cool","uh oh","ooo","w tim","whattttt","oh my","kishan","ww red","ayoo","mmm","no one said that","deji","400k","thank you","insane","bro what","what?","nahh","omggg","و عليكم السلام","vamos","f5","sniffa","leaked","rime","ayy 󠀀","unlucky","hahahahah","loll","lolol","looooool","lfg","hi guys","hacked","ye","awww","bra","ww beavo","taway","wedidit","lazer woo","assept","let it go","ww siggy","12","oop","whatttt","oh my god","never","ha","focus","looool","wwwwwwwwwwwww","this guy","wth","wwwwwwwwwwww","pwr","yooooo","jorkin","lmaaooo","ez points","?????????????","hell nah","mmmmmmmmmmmmmm","here he go","pffttt 󠀀","ewwwwww","clix","cap of doom","darla","damn lacy","sup","thx","i was here","nvm","well well well","huh?","brother","pause","clueless","hlo","ahahahaha","lies","ta 󠀀","ome44 󠀀","jira","noticinggg","call clix","pffttt pffttt","lmfaooooooooooooo","max coming","ww elizabeth","gerd","ez clap","bwajaja","lock in","dang","noo","close","aint no way","red","eu","nahhhhh","peepodj","ewwwwwww","ayooo","gachibass","jungcooked","alien3","hinge","herewego","hollon","big oz","gl","uwu","lollll","ayoooo","uh","oi","lmaooooooooooo","black","ohhh","hi everyone","tc","السماء الزرقاء","we back","lets gooooo","wwwwwwwwwwwwww","offline","huh 󠀀","catpls","cappp","asked and answered","ww 10","ll ego","lmfao lmfao lmfao","ww press","gg lacy","lmfaoooooooooooo","xqc","ick monster","bob","huhh","cooked","chill","yessss","lololol","let's go","pari g sis","hehe","nhi","привет","woooo","ai","lets goo","tuff","w torsos","feed bepsy","ewww 󠀀","steph curry","ironic","ta attack","ll jason","mmmmmmmmmmmmm","mmmmmmmmmmmm","blm","ww jax","l print","nice shot","lool","football","clean","aww","sorry","yesssss","hello guys","max","ruined","sakina are","hahahahahaha","nothing","lady","bholenath","boom","o na","widespeedlaugh2","knutwalk","hah 󠀀","juuh","relevance","marie","pre 3","pre 10","ww mans","pity 8","show the edit","cap cap","dude","ty","wrong","sadge","copium","flirt","normal","hasan","nooooooo","timing","who is this","hey everyone","guys","you","hm","well","pred","interesting","loooool","yoooooo","what happened","hallowfall","gg 󠀀","aliendance","? 󠀀","waste of time","wow 󠀀","ll host","yap","oh hell nah","check","oz","jax","capp","solos","man of bumps","19","403","lucky","good morning","washed","brooo","ahahaha","wrong boots","??????????????","run","heyy","omggggg","hi all","المحققة ؟","forsen","ohh",".....","omgggg","l ads","what is this","mrsavaben","gg's","nahhhhhh","call him","aware","bang","cs","khanada","santi","pfffttt","night trap","raid","ww jason","omefaded","ll print","hiii colleen","duos","play cmb","arky lying","rofl","yikes","good one","lolll","noooooooo",".......","uhm","omgg","amen","ouch","sigma","usa","boring","gym","pls","mods","bathroom entrance","xit","ewwwwwwww","alizee","wolfie","me too","emp","......","good boy","oj","last","عليكم السلام","ggm1","ta ta ta","uhhhhh","firstgarf","ez 4 m80","ooooo","noway 󠀀","na defense","objection","casa","hell no","widereacting","ww instigator","lfmao","jasssssssson","lmaaaoooo","bring us with you","10/10","ftc","mr 5.5","arky45","lmfao arky","maybe","wut","gg ez","almost","zzz","good night","weird","sure","widevibe","no shot","click","jk","gggg","woo","ads","qual","moi 7e luokka","um","who?","oops","man","wait","ugh","eh","he is","mit wem spielt er","muted","benn","feelsstrongman","hell yeah","derp2","cuuh","rizz","camariah","deadge","???????????????","booba","ll poll","miz","ick","raid veno","hiii 󠀀","abb demon","0/3","oh nahhh","w elizabeth","show edit","arkyyy","check earnings","400k a month","squads","kc","letttss gooooo maxx","14","1000","amazing","lul","wat","i do",":(","broo","who cares","gooo","it is","erm","oh brother","okk","peace","goodnight","chat","woww","bye bye","morning","elsa","tsunami","hn","ok bye","gogeta","really","priya","sa","ciao","huhhhh","lotus","blue sky","ong","lets goooooooo","pfffft","e z","moin","whatt","wwwwwwwwwwwwwww","yessir","kekl","dance","just go","w red","oooooo","niceee","w deshae","call deshae","vip","veno","分かった","weirdo","lmfoa","behind you","ayy ayy","w cap","noticing","o z","what?????","what is happening","lmaoooooooooooooo","ww yay","ar","jassssssssson","rime mommy","ww t1","devry","4love lac","oh hell no","oooo 50","jumpscare","mmmmmmmmmmmmmmm","ww john","w lacy","lmaoooooooooooo","w jax","play max song","buh buh","man of steel","buh buh buh","cmon kc","13","50","150","good luck","np","right","so close","congratulations","joever","lolololol","please","welp","fair","my goat","wowwww","womp womp","not bad","whatttttt","again","lets goooooo","next week","there is","perfect","ooof","oh boy","alisha","sumedh","si","walaikum assalam","card","hahahahahahaha","wha","blackjack","i love it","xddd","heyyyy","hlw","hmmmmm","yooooooooo","kyu","scatter","うん","hallo","*sips horchata*","oo","hi chat","ozempic","rezon","ne","w graal","foul ball","meatloaf","mm","come on","lmaooooooooooooo","lmaaaooo","oh god","oh nahh","nessie","ome3","schizo","what a pass","gooner","ottt","bye az","ww pr","l ego","geng washed","piece red","reallymad","oce > na","mizunprepared","uuhh","dead","can i play","furia","full motion video","ron dtm","chip 󠀀","lmfaoooooooooooooo","????????????????","ww predify","hiii hiii","commmmmmmmmmm","nobody said that","honey pack","edit","capppp","pre 4","frank ocean","ww deji","short","hot to go","ssg","16","awesome","hype","kk","nice one","sheeeesh","wait what","crashout","the goat","bro...","noice","both","here we go again","yapping","we?","w stream","omggggggg","why not","cute","cheers","none","niceeee","اي","not really","help","hii guys","fadak","да","boy","hiiiiii","anyways","jay one","yoooooooo","hell","sakin","ahhhh","hail","ron","get it","sell","ope","w song","complent","bye guys","ggg","richa","dont","its over","nooooooooo","fff","glazing","gg gg","yo bro","twink","awwww","hack","ww ww ww","ww adapt","col is finished","kirbycoom","vip deshae","lmfao what","rizz dot","no ot","l host","free palestine","i am","activationfingers","lets go pwr","gggggg","ayy2","cs2","ww timing","loooooooooool","delete capcut","uuh uuh uuh","???????????????????","ugly emp","ta lk","jason?","jason","bedge","this guy hah","hdmi","ww gooner","both?","caught caught","helloimmaxwell","what???","huh huh","0/4","cap of hell","w h a t","mmmmmmmmmmmmmmmm","owow","vinnie","ww 45","piece arky","srry","lacy cap","arky capping","ww bepsy","22","26","kappa","lulw","calculated","amogus","nice try","noted","waiting","nooooooooooo","cope","hahahhaha","easy","awkward","what is going on","whoa","ummm","ok ok",":3","nodders","q first","so","hahahahha","ban","byeee","ya","rose","görüşürüzz","skibidi sigma","aw","اوك","مرحبا","yeahh","left","niharika","gtk","لا","omg lol","hello all","umm","hello?","hi faith","good morning faith","hi.","gulp","cherry","kevin","how are you","*chuckles*","ohhhh","oxygen","سلام عليكم","og","alr","free","hi happy","l beard","-_-","goty","tata","no lol","comm","maram","savage","hahahahahah","ayo?","thank god","sick","looooooooool","holy crap","sez u","wowww","bepsy aura","lift0","alien44","ome20","lazy","w gifted","ayoooooo","yessssss","vip him","xdd 󠀀","jeez","qual?","ww hasan","yam","monkers","w pwr","luck","letsgooo","na washed","real voice lmfao","ww 808","o7 󠀀","firstdork","dumbass","hard watch","goon","dragging it","ww lag","ww f","sheeesh","hah mods","drops","u did this","o ma","o 󠀀","ravetime","lll","bs","commm","ron stfu","w hasan","yooooooo","ome44 ome44","jassssssson","jasssssssssssson","jasssssson","sonii","will","he coming","elizabeth","hah hah hah","fake chat","nahhhhhhh","w honesty","chopped","tacaught","lunch","w max","lmfaooooooooooooooo","uhhhh","ewwwwwwwwww","rockin","5k","check his earnings","trios","freak","lmfao max","arky lmao","what 󠀀","poor dude","8.3","15","peepoclap","ayyy","clutch","gn","happy birthday","congrats","blabbering","off","this is crazy","sad","so true","val","game","saved","noooooooooooooo","noooooooooo","bro?","lets gooooooooo","big w","ah","hahahahhahaha","miami","japan","valorant","good flash","hahahahahahahaha","assalamualaikum","good job","its ok","oh yeah","hold","i agree","bruhhh","liar","w gooner","tupang","word","cmon","green","00","love","win","wsg","احبك","=)","helloo","i knew it","accha","null","lupz","hy","me?","yeahhh","adios","privet","selam","kartal","holy moly","helloooo","ahh","dang it","absolute cinema","kicks","im back","nhii","may","ha?","hahhaha","hnnn","beard","janvi","lol.","what a shot","ns","rip az","yassss","respect","yash bro","whoops","aliyeva","اتقوا الله","***","ne(yankili)","jt","hnn","homie","im dying","qualed ?","ggez","grim.","nein","كيفن","kick jt","usa usa usa","هههههههه","madge","why skip","na production","ez 󠀀","ww ad","ta ta ta ta","knutready","rug juice","relax","yes 󠀀","gg\\","ll friend","pffttt2","gay af","coming","ww asian brother","regret","w save","daddy","call","was","no no no","ww santi","disgusting","lmaoaoa","weebsdetected","colleen","my oil","brooooo","what the","ego 󠀀","awwe","weak","wuh","ew 󠀀","w press","oooo oooo","speak up","nepo","ليلي","ooooooo","lmaaoo","whats going on","you got this","my points","omescrajj","gigachad sonii","send it to cinna","jorkers","ooh","nowaying","lacy comment","bricked","lets go furia","lmaoooooooooo 󠀀","l ad","w ad","reacting","solo cc","what????","poor guy","jassssssssssson","taj","taassemble","0-3 esports","commmmmmmmmmmm","commmmmmmmmm","lock the door","hes coming","play it","damm","bad pics","pre 5","ofcccc","jerry woo","omestare","pre 1","oh nahhhh","lmao lmao","wow wow","silky","jerkify","kiss","6????","do xqc","arkyyyy","امين","w h a tt","check it","lmfaoaooo","saj 󠀀","emilio","so jason","well stream","arky lmfao","capping 󠀀","tya","piece vinnie","om 󠀀","5.3","the man of meat","man of shmeat","duke","no f","17","21","23","greetings","well played","absolutely","correct"])

let longestLength = 19; // safePhrases.reduce((maxLength, str) => Math.max(maxLength, str.length), 0);
var quickPass = 0;
var newlyAdded = 0;

function isSafePhrase(data) {
	
	let cleanedText = data.chatmessage;
            
    if (!data.textonly) {
        cleanedText = decodeAndCleanHtml(cleanedText);
    }
	
	cleanedText = cleanedText.replace(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu, "").replace(/[\u200D\uFE0F]/g, ""); // Remove zero-width joiner and variation selector
	cleanedText = cleanedText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/gi, ""); // fail safe?
	cleanedText = cleanedText.replace(/[\r\n]+/g, "").replace(/\s+/g, " ").trim();
	cleanedText = cleanedText.toLowerCase();
	 
    if (!cleanedText) { // nothing, so it's safe.
        return { isSafe: true, cleanedText: "" };
    }
    if (cleanedText.length > longestLength) {
        return { isSafe: false, cleanedText };
    }
    if (!cleanedText) {
        return { isSafe: true, cleanedText };
    }
    if (cleanedText.length == 1) {
        return { isSafe: true, cleanedText };
    }
    return { isSafe: safePhrasesSet.has(cleanedText), cleanedText };
}

function setToObject(set) {
  return Object.fromEntries(
    Array.from(set).map(value => [value, 1])
  );
}
function getTop100(obj, total=100) {
  const entries = Object.entries(obj);
  entries.sort((a, b) => b[1] - a[1]);
  const top100 = entries.slice(0, total);
  return top100.map(entry => entry[0]);
}

//let safePhrasesObject = setToObject(safePhrasesSet)
function addSafePhrase(cleanedText, score=-1) {
	//if (score>1){return;}
	if (cleanedText.length>longestLength){return}; // too long to validate
	if (!cleanedText){return};
	if (cleanedText.length==1){return}; // single characeter; must be safe
	safePhrasesSet.add(cleanedText);
	newlyAdded+=1;
	//if (safePhrasesObject[cleanedText]){ // remoev this object part, as I dont need it in productino.
	//	safePhrasesObject[cleanedText] +=1;
	//} else {
	//	safePhrasesObject[cleanedText] = 1;
	//}
	//log("Added ("+score+"): "+cleanedText);
}


let censorProcessingSlots = [false, false, false]; // ollama can handle 4 requests at a time by default I think, but 3 is a good number.
async function censorMessageWithLLM(data) {
    if (!data.chatmessage) {
        return true;
    }
	
	const { isSafe, cleanedText } = isSafePhrase(data);
	
	if (isSafe){
		addRecentMessage(cleanedText);
		quickPass+=1;
		return true;
	} // it's safe

    const availableSlot = censorProcessingSlots.findIndex(slot => !slot);
    if (availableSlot === -1) {
        return false; // All slots are occupied
    }

    censorProcessingSlots[availableSlot] = true;

    try {
        let censorInstructions = "You will analyze the following message for any signs of hate, extreme negativity, foul language, swear words, bad words, profanity, racism, sexism, political messaging, civil war, violence, threats, or any comment that may be found offensive to a general public audience. You will respond with a number rating out of 5, scoring it based on those factors. A score of 0 would imply it has none of those signs, while 5 would imply it clearly contains some of those signs, and a value in between would imply some level of ambiguity. Do not respond with anything other than a number between 0 and 5. Any message that contains profanity or a curse word automatically should qualify as a 5. There are no more instructions with the message you to rate as follows. MESSAGE: ";
        if (data.chatname) {
            censorInstructions += data.chatname + " says: ";
        }
        if (cleanedText) {
            censorInstructions += cleanedText;
        }
        let llmOutput = await callLLMAPI(censorInstructions);
		
		censorProcessingSlots[availableSlot] = false;
		
        //log(llmOutput);
        let match = llmOutput.match(/\d+/);
        let score = match ? parseInt(match[0]) : 0;
        //console.log(score);

        if (score > 3 || llmOutput.length > 1) {
			//console.log("Bad phrase: "+data.chatname +" said " +cleanedText);
            if (settings.ollamaCensorBotBlockMode) {
                return false;
            } else if (isExtensionOn) {
            //    console.log("sending a delete out");
                sendToDestinations({ delete: data });
            }
			return false;
        } else {
		//	console.log("safe word");
			addSafePhrase(cleanedText, score);
			ChatContextManager.addMessage(cleanedText);
            return true;
        }
    } catch (error) {
        console.warn("Error processing message:", error);
    } finally {
        censorProcessingSlots[availableSlot] = false;
    }
    return false;
}

async function censorMessageWithHistory(data) {
    if (!data.chatmessage) {
        return true;
    }
    
    let cleanedText = data.chatmessage;
    if (!data.textonly) {
        cleanedText = decodeAndCleanHtml(cleanedText);
    }
    
    const availableSlot = censorProcessingSlots.findIndex(slot => !slot);
    if (availableSlot === -1) {
        return false; // All slots are occupied
    }
    censorProcessingSlots[availableSlot] = true;

    try {
        // Get recent messages from ChatContextManager's cache
        const recentMessages = ChatContextManager.cache.recentMessages;
        
        let censorInstructions = `Analyze the following live text chat history and the latest message for any signs of hate, extreme negativity, foul language, swear words, bad words, profanity, racism, sexism, political messaging, civil war, violence, threats, or any content that may be offensive to a general public audience. Messages may be long or very short, such as a single letter or a collection of emoji-based characters. Pay special attention to words that might be spelled out across multiple messages. Respond ONLY with a number rating out of 5, where 0 implies no offensive content and 5 implies clearly offensive content. Any message containing profanity or curse words automatically qualifies as a 5. ONLY respond with a number between 0 and 5 and nothing else.

Recent chat history:
${recentMessages.map(m => m.message).join('\n')}

Latest message:
${data.chatname} says: ${cleanedText}`;

        let llmOutput = await callLLMAPI(censorInstructions);
        
        censorProcessingSlots[availableSlot] = false;
        
        let match = llmOutput.match(/\d+/);
        let score = match ? parseInt(match[0]) : 0;
        
        if (score > 3 || llmOutput.length > 1) {
            if (settings.ollamaCensorBotBlockMode) {
                return false;
            } else if (isExtensionOn) {
                sendToDestinations({ delete: data });
            }
            return false;
        } else {
            addSafePhrase(cleanedText, score);
            ChatContextManager.addMessage({
                chatname: data.chatname,
                message: cleanedText,
                timestamp: Date.now()
            });
            return true;
        }
    } catch (error) {
        console.warn("Error processing message history:", error);
    } finally {
        censorProcessingSlots[availableSlot] = false;
    }
    return false;
}


function checkTriggerWords(triggerString, sentence) {
    // For phrase matching, first check if it's a simple space-separated phrase (no commas or modifiers)
    if (!triggerString.includes(',') && !triggerString.includes('+') && !triggerString.includes('-') && !triggerString.includes('"')) {
        const phrase = triggerString.toLowerCase().trim();
        // Special characters like ! need special handling with word boundaries
        if (/^[!@#$%^&*]/.test(phrase)) {
            // For phrases starting with special chars, don't use word boundary at start
            const wordPart = phrase.replace(/^[!@#$%^&*]+/, '');
            const specialPart = phrase.substring(0, phrase.length - wordPart.length);
            const regex = new RegExp(`${specialPart}\\b${wordPart}\\b`, 'i');
            return regex.test(sentence.toLowerCase());
        } else {
            // Create a regex with word boundaries for the phrase
            const regex = new RegExp(`\\b${phrase}\\b`, 'i');
            return regex.test(sentence.toLowerCase());
        }
    }
    
    // Rest of the function remains the same
    const triggers = triggerString.match(/(?:[^,\s"]+|"[^"]*")+/g)
        .map(t => t.trim())
        .filter(t => t);
    
    const required = [];
    const excluded = [];
    const normal = [];
    
    triggers.forEach(trigger => {
        if (trigger.startsWith('+')) {
            required.push(processTrigger(trigger.slice(1)));
        } else if (trigger.startsWith('-')) {
            excluded.push(processTrigger(trigger.slice(1)));
        } else {
            normal.push(processTrigger(trigger));
        }
    });
    
    function processTrigger(trigger) {
        const isQuoted = trigger.startsWith('"') && trigger.endsWith('"');
        let word = trigger;
        let startBoundary = false;
        let endBoundary = false;
        
        if (isQuoted) {
            word = trigger.slice(1, -1);
        }
        
        if (word.startsWith(' ')) {
            startBoundary = true;
            word = word.trimStart();
        }
        if (word.endsWith(' ')) {
            endBoundary = true;
            word = word.trimEnd();
        }
        
        return {
            word,
            isQuoted,
            startBoundary,
            endBoundary
        };
    }
    
    function checkWord(triggerObj, sentence) {
        const { word, isQuoted, startBoundary, endBoundary } = triggerObj;
        
        if (isQuoted) {
            return sentence.includes(word);
        }
        
        const lcWord = word.toLowerCase();
        const lcSentence = sentence.toLowerCase();
        
        // Improved regex to properly capture special characters with words
        const matches = lcSentence.match(/[!@#$%^&*]+\w+|\w+(?:'\w+)*|[.,;]|\s+/g) || [];
        
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i].trim();
            
            if (!current || !/\w/.test(current)) continue;
            
            if (current === lcWord) {
                if (startBoundary && i > 0 && /\w/.test(matches[i - 1])) continue;
                if (endBoundary && i < matches.length - 1 && /\w/.test(matches[i + 1])) continue;
                return true;
            }
        }
        
        return false;
    }
    
    for (const trigger of excluded) {
        if (checkWord(trigger, sentence)) {
            return false;
        }
    }
    
    for (const trigger of required) {
        if (!checkWord(trigger, sentence)) {
            return false;
        }
    }
    
    if (normal.length > 0) {
        return normal.some(trigger => checkWord(trigger, sentence));
    }
    
    return true;
}

let isProcessing = false;
const lastResponseTime = {};
// lastSentMessage is already declared in background.js

const hostReflectionTracker = new Map();
const HOST_REFLECTION_TTL_MS = 20 * 1000; // mirror duplicate reflection window

function pruneHostReflectionTracker(now = Date.now()) {
    for (const [key, timestamp] of hostReflectionTracker.entries()) {
        if (now - timestamp > HOST_REFLECTION_TTL_MS) {
            hostReflectionTracker.delete(key);
        }
    }
}

function getHostReflectionKey(data, message) {
    if (!data || !message) {
        return null;
    }
    const tid = data.tid !== undefined && data.tid !== null ? String(data.tid) : 'no-tab';
    const user = data.chatname ? data.chatname.toLowerCase() : (data.userid ? String(data.userid).toLowerCase() : 'unknown');
    return `${tid}:${user}:${message}`;
}

async function processSummary(data){
	//console.log(data);
	if (!data.tid) return data;
	const currentTime = Date.now();
	if (isProcessing) return data;
	isProcessing = true;
	
	let ollamaRateLimitPerTab = 5000;
	if (settings.ollamaRateLimitPerTab) {
	  ollamaRateLimitPerTab = Math.max(0, parseInt(settings.ollamaRateLimitPerTab.numbersetting) || 0);
	}
	
	if (data.type !== "stageten" && !settings.ollamaoverlayonly && data.tid && 
		lastResponseTime[data.tid] && (currentTime - lastResponseTime[data.tid] < ollamaRateLimitPerTab)) {
		isProcessing = false;
		return data;
	}

	try {
		var summary = await ChatContextManager.getSummary();
	} catch(e){
		isProcessing = false;
		return data;
	}
	isProcessing = false;
	//console.log(summary);
	if (summary){
		let botname = "🤖💬";
		if (settings.ollamabotname?.textsetting) {
		  botname = settings.ollamabotname.textsetting.trim();
		}
		
		sendTargetP2P({
			chatmessage: summary,
			chatname: botname,
			chatimg: "./icons/bot.png",
			type: "socialstream",
			request: data,
			tts: settings.ollamatts ? true : false
		  }, "bot");

		  // Send to tabs if not overlay-only
		if (!settings.ollamaoverlayonly) {
			const msg = {
			  tid: data.tid,
			  response: settings.noollamabotname ? summary.trim() : (botname + ": " + summary.trim()),
			  bot: true
			};
			sendMessageToTabs(msg);
			lastResponseTime[data.tid] = Date.now();
		}
	}
	return data
}

async function processMessageWithOllama(data, idx=null) { 
  if (!data.tid) return;
  
  const currentTime = Date.now();
  if (isProcessing) return;
  
  //console.log("starting processing");
  isProcessing = true;
  try {
    // Rate limiting logic
    let ollamaRateLimitPerTab = 5000;
    if (settings.ollamaRateLimitPerTab) {
      ollamaRateLimitPerTab = Math.max(0, parseInt(settings.ollamaRateLimitPerTab.numbersetting) || 0);
    }
    
    if (data.type !== "stageten" && !settings.ollamaoverlayonly && data.tid && lastResponseTime[data.tid] && (currentTime - lastResponseTime[data.tid] < ollamaRateLimitPerTab)) {
      isProcessing = false;
      const waitMs = Math.max(0, ollamaRateLimitPerTab - (currentTime - lastResponseTime[data.tid]));
      noteChatBotDecision('rate-limited', data, { waitMs });
      return;
    }

    // Bot name handling
    let botname = "🤖💬";
    if (settings.ollamabotname?.textsetting) {
      botname = settings.ollamabotname.textsetting.trim();
    }

    // Early return conditions
    if ((data.type === "stageten" && botname === data.chatname) || !data.chatmessage || (!settings.noollamabotname && data.chatmessage.startsWith(botname + ":"))) {
      isProcessing = false;
      noteChatBotDecision('ignored-self-message', data);
      return;
    }

    // Trigger words check
    if (settings.bottriggerwords?.textsetting.trim()) { // bottriggerwords
      if (!checkTriggerWords(settings.bottriggerwords.textsetting, data.chatmessage)) {
        isProcessing = false;
        noteChatBotDecision('missing-trigger', data);
        return;
      }
    }

    // Clean message text
    let cleanedText = data.chatmessage;
    if (!data.textonly) {
      cleanedText = decodeAndCleanHtml(cleanedText);
    }
    cleanedText = cleanedText.replace(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu, "")
      .replace(/[\u200D\uFE0F]/g, "")
      .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/gi, "")
      .replace(/[\r\n]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanedText) {
      isProcessing = false;
      noteChatBotDecision('empty-after-cleaning', data);
      return;
    }

    // Prevent self-replies
    const allowHostReflectionResponse = Boolean(
      data?.reflection &&
      data?.hostReflection &&
      settings?.chatbotRespondToReflections &&
      !data?.chatbotReflection
    );

    let hostReflectionKey = null;
    if (allowHostReflectionResponse) {
      hostReflectionKey = getHostReflectionKey(data, cleanedText);
      pruneHostReflectionTracker();
      if (hostReflectionKey && hostReflectionTracker.has(hostReflectionKey)) {
        isProcessing = false;
        noteChatBotDecision('reflection-already-handled', data);
        return;
      }
    }

    if (!allowHostReflectionResponse) {
      const score = fastMessageSimilarity(cleanedText, lastSentMessage);
      if (score > 0.5) {
        isProcessing = false;
        noteChatBotDecision('too-similar-to-last-reply', data);
        return;
      }
    } else {
      noteChatBotDecision('reflection-similarity-override', data);
    }

    // Get additional instructions
    let additionalInstructions = "";
    if (settings.ollamaprompt) {
      additionalInstructions = settings.ollamaprompt.textsetting;
    }
	//console.log(additionalInstructions, cleanedText, botname, data);
	const response = await processUserInput(cleanedText, data, additionalInstructions, botname);

	let shouldSendResponse = false;
	if (response && typeof response === 'string') {
	  const lowerResponse = response.toLowerCase();
	  shouldSendResponse = (
	    !response.includes("@@@@@") &&
	    !lowerResponse.startsWith("not available") &&
	    (settings.alwaysRespondLLM || (
	      !response.includes("NO_RESPONSE") &&
	      !response.startsWith("No ") &&
	      !response.startsWith("NO ")
	    ))
	  );
	}
	//console.log(response);

	// Handle response
	if (shouldSendResponse) {
	  if (allowHostReflectionResponse && hostReflectionKey) {
		// Mark the reflection as handled only if we are about to emit a reply
		hostReflectionTracker.set(hostReflectionKey, Date.now());
	  }
	  
	  // Send to overlay if enabled
	  sendTargetP2P({
		chatmessage: response,
        chatname: botname,
        chatimg: "./icons/bot.png",
        type: "socialstream",
        request: data,
        tts: settings.ollamatts ? true : false
      }, "bot");
      
      // SECONDARY FIX: Track bot's own message for overlay-only mode
      // Uncomment to test if overlay-only mode needs this
      // if (settings.ollamaoverlayonly) {
      //   lastSentMessage = response;
      // }

      // Send to tabs if not overlay-only
      if (!settings.ollamaoverlayonly) {
        const msg = {
          tid: data.tid,
          response: settings.noollamabotname ? response.trim() : (botname + ": " + response.trim()),
          bot: true
        };
        sendMessageToTabs(msg);
        lastResponseTime[data.tid] = Date.now();
        lastSentMessage = response;
      }
	  data.botResponse = response;
	  
	  // Store the bot response in the database
      if (data.idx && response) {
		if (typeof data.idx == "function"){
			let idx = await Promise.resolve(data.idx);
			delete data.idx;
			await messageStoreDB.updateMessage(idx, data);
		} else {
			let idx = data.idx;
			delete data.idx;
			await messageStoreDB.updateMessage(idx, data);
		}
	  } 
    } else {
	  if (response) {
		const preview = typeof response === 'string' ? response.slice(0, 80) : '';
		noteChatBotDecision('llm-declined', data, preview ? { snippet: preview } : {});
	  } else {
		noteChatBotDecision('no-response-generated', data);
	  }
    }

  } catch (error) {
    console.warn("Error processing message:", error);
  } finally {
    isProcessing = false;
  }
}

async function processUserInput(userInput, data, additionalInstructions, botname) {
  try {
    // Build base prompt with context
    let promptBase = `${additionalInstructions || ''}\n\nYou are an AI chat assistant and a participant in a live group chat room.`;
	
	let botname = "Bot";
    if (settings.ollamabotname?.textsetting) {
		botname = settings.ollamabotname.textsetting.trim();
    }
	if (botname){
		promptBase += `\n\nYour name in the group chat is: ${botname}.\n\nSpeak only when important or when spoken directly to by name.`;
	} else {
		promptBase += `\n\nSpeak only when it's exceedingly helpful to be doing so.`;
	}
	
	if (!settings.nollmcontext){
		// Get context first
		
		const context = await ChatContextManager.getContext(data);
		
		//console.log(data);
		//console.log(context);
		
		// Add context elements
		if (context.chatSummary) {
		  promptBase += `\n\nChat Overview:\n ${context.chatSummary}`;
		}
		
		if (context.recentMessages) {
		  promptBase += `\n\nRecent Messages:\n ${context.recentMessages}`;
		}
		
		if (context.userHistory) {
			promptBase += `\n\nPrevious messages from ${data.chatname} via ${data.type} chat:\n ${context.userHistory}`;
		}
		
		promptBase += `\n\nCurrent message from ${data.chatname}: ${userInput}`;
	} else {
		promptBase += `\n\nCurrent group chat message from ${data.chatname}: ${userInput}`;
	}

    // Add current message
    

    // Check if RAG is needed
    if (await isRAGConfigured()) {
	  const databaseDescriptor = localStorage.getItem('databaseDescriptor') || '';
	  
	  const ragPrompt = `${promptBase}` + 
		'If this message requires searching the knowledge database, respond with keywords to search. Otherwise respond with NO_RESPONSE. Keywords should be space-separated terms that will find relevant information in the database.' +
		'\n\nDatabase info: ${databaseDescriptor}\n\n';

	  const ragDecision = await callLLMAPI(ragPrompt);
	  
	  if (ragDecision && !ragDecision.toLowerCase().includes('no_response')) {
		const searchResults = await performLunrSearch(ragDecision.trim());
		return await generateResponseWithSearchResults(userInput, searchResults, data.chatname, additionalInstructions);
	  } else {
		// Fall through to regular response handling
		if (settings.alwaysRespondLLM) {
		  promptBase += '\n\nRespond conversationally to the current group chat message, doing so directly and succinctly.';
		} else {
		  promptBase += '\n\nRespond conversationally to the current group chat message only if the message seems directed at you specifically, doing so directly and succinctly, or instead reply with NO_RESPONSE if no response is needed. Respond only with NO_RESPONSE if you have no reply.';
		}
		
		let response = await callLLMAPI(promptBase);
		
		if (botname && response.startsWith(botname+":")){
			response = response.replace(botname+":","").trim();
		}
		
		if (!response || response.toLowerCase().includes('no_response') || response.toLowerCase().startsWith('no ') || response.toLowerCase().startsWith('@@@@')) {
		  if (settings.alwaysRespondLLM && (response && !response.toLowerCase().startsWith('@@@@'))) {
			return response;
		  }
		  return false;
		}
		
		return response;
	  }
	} else {
      // Regular response with context
	  
	  
		let debugmode = false;
		if (settings.ollamabotname?.textsetting) {
			debugmode = settings.ollamabotname?.textsetting == "Tommas" ? true : false;
		}
	  if (debugmode){
		  if (!settings.nollmcontext){
			  promptBase += '\n\nRespond conversationally to the current message, if appropriate, doing so directly and succinctly, or instead reply with NO_RESPONSE, followed by stating why no response is needed.';
		  } else {
			  promptBase += '\n\nRespond conversationally to the current group chat message only if the message seems directed at you specifically, doing so directly and succinctly, or instead reply with NO_RESPONSE if no response is neede, followed by why no response was needed.';
		  }
	  } else if (settings.alwaysRespondLLM){
		  if (!settings.nollmcontext){
			  promptBase += '\n\nRespond conversationally to the current message, doing so directly and succinctly.';
		  } else {
			  promptBase += '\n\nRespond conversationally to the current group chat message, doing so directly and succinctly.';
		  }
		  
	  } else {
		  if (!settings.nollmcontext){
			  promptBase += '\n\nRespond conversationally to the current message, if appropriate, doing so directly and succinctly, or instead reply with NO_RESPONSE to state you are choosing not to respond. Respond only with NO_RESPONSE if you have no reply.';
		  } else {
			  promptBase += '\n\nRespond conversationally to the current group chat message only if the message seems directed at you specifically, doing so directly and succinctly, or instead reply with NO_RESPONSE if no response is needed. Respond only with NO_RESPONSE if you have no reply.';
		  }
	  }
	  //console.log(promptBase);
      
      let response = await callLLMAPI(promptBase);
	  
	  if (botname && response.startsWith(botname+":")){
		response = response.replace(botname+":","").trim();
	  }
	  
      if (!response || response.toLowerCase().includes('no_response') || response.toLowerCase().startsWith('no ') || response.toLowerCase().startsWith('@@@@')) {
		if (settings.alwaysRespondLLM && (response && !response.toLowerCase().startsWith('@@@@'))){
			return response;
		}
        return false;
      }
      
      return response;
    }
  } catch (error) {
    console.warn("Error in processUserInput:", error);
    return false;
  }
}


function preprocessMarkdown(content) {
    // Remove HTML comments
    content = content.replace(/<!--[\s\S]*?-->/g, '');

    // Process the content line by line
    const lines = content.split('\n').map(line => {
        // Trim whitespace
        line = line.trim();

        // Simplify headers
        line = line.replace(/^#+\s*/, '# ');

        // Remove emphasis markers
        line = line.replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2');

        // Remove inline code backticks
        line = line.replace(/`([^`]+)`/g, '$1');

        // Simplify links
        line = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

        // Simplify images
        line = line.replace(/!\[([^\]]+)\]\([^\)]+\)/g, '$1');

        // Remove horizontal rules
        if (line.match(/^(-{3,}|_{3,}|\*{3,})$/)) {
            return '';
        }

        return line;
    }).filter(line => line.length > 0); // Remove empty lines

    // Combine consecutive list items
    for (let i = lines.length - 1; i > 0; i--) {
        if ((lines[i].startsWith('- ') && lines[i-1].startsWith('- ')) ||
            (lines[i].startsWith('* ') && lines[i-1].startsWith('* ')) ||
            (lines[i].match(/^\d+\. /) && lines[i-1].match(/^\d+\. /))) {
            lines[i-1] += ' ' + lines[i].replace(/^(-|\*|\d+\.) /, '');
            lines.splice(i, 1);
        }
    }

    // Remove code blocks or replace with placeholder
    content = lines.join('\n');
    content = content.replace(/```[\s\S]*?```/g, '[CODE BLOCK]');

    // Remove any remaining multiple consecutive spaces
    content = content.replace(/ {2,}/g, ' ');

    return content;
}


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function preprocessDocument(docContent, docId, preprocess) {
    activeProcessing[docId] = { cancel: false };
    
    updateDocumentProgress(docId, 1, 'Preprocessing');
    
    // Split the content into lines
    const lines = docContent.split('\n');
    
    // Initialize variables
    const chunks = [];
    let currentChunk = '';
    let currentTitle = 'Document Start';
	if (!preprocess){
		currentTitle = "";
	}
    let currentLevel = 0;
    
    function processCurrentChunk_old() {
        if (currentChunk.trim()) {
            chunks.push({
                title: currentTitle,
                content: currentChunk.trim(),
                level: currentLevel
            });
            currentChunk = '';
        }
    }
	
	function processCurrentChunk() {
		if (currentChunk.trim()) {
			if (chunks.length > 0 && chunks[chunks.length - 1].content.length + currentChunk.length <= maxContextSize) {
				// Combine with the previous chunk if it fits
				chunks[chunks.length - 1].content += '\n\n' + currentChunk.trim();
				chunks[chunks.length - 1].title += ' & ' + currentTitle;
			} else {
				chunks.push({
					title: currentTitle,
					content: currentChunk.trim(),
					level: currentLevel
				});
			}
			currentChunk = '';
		}
	}
    
    // Process each line
    for (const line of lines) {
        if (activeProcessing[docId].cancel) {
            log(`Processing cancelled for document ${docId}`);
            delete activeProcessing[docId];
            return null;
        }
        
        // Check if the line is a header
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            // If we're about to exceed 8K chars or encounter a new header, process the current chunk
            if (currentChunk.length + line.length > maxContextSizeFull || currentChunk.length > 0) {
                processCurrentChunk();
            }
            
            // Start a new chunk with the header
            currentLevel = headerMatch[1].length;
            currentTitle = headerMatch[2];
            currentChunk = line + '\n';
        } else {
            // If adding this line would exceed 8K chars, process the current chunk and start a new one
            if (currentChunk.length + line.length > maxContextSizeFull) {
                processCurrentChunk();
                // If the current line itself is very long, split it
                if (line.length > maxContextSizeFull) {
                    for (let i = 0; i < line.length; i += maxContextSizeFull) {
                        chunks.push({
                            title: `${currentTitle} (continued)`,
                            content: line.substr(i, maxContextSizeFull),
                            level: currentLevel
                        });
                    }
                } else {
                    currentChunk = line + '\n';
                }
            } else {
                // Add the line to the current chunk
                currentChunk += line + '\n';
            }
        }
    }
    
    // Process the last chunk
    processCurrentChunk();
    
    updateDocumentProgress(docId, 5, 'Chunking');
	
	if (!preprocess){
		delete activeProcessing[docId];
		return {
			chunks: chunks,
			overallSummary: ""
		};
	}
    
    // Process each chunk with Ollama
    const processedChunks = [];
    for (const [index, chunk] of chunks.entries()) {
        if (activeProcessing[docId].cancel) {
            log(`Processing cancelled for document ${docId}`);
            delete activeProcessing[docId];
            return null;
        }
        
		const prompt = `Analyze the following document chunk (${index + 1}/${chunks.length}) and provide the following information:

1. Summarize the main points in 2-3 sentences.
2. Generate 5-7 relevant tags.
3. Suggest 3-5 synonyms or related terms for the main concepts.

Document chunk title: ${chunk.title}
Document chunk:
${chunk.content}

Please format your response exactly as follows, including the delimiters:

[SUMMARY]
Your summary here.
[/SUMMARY]

[TAGS]
tag1, tag2, tag3, tag4, tag5
[/TAGS]

[SYNONYMS]
synonym1, synonym2, synonym3
[/SYNONYMS]

Do not include any other text or explanations outside these sections.`;

		try {
			const processedData = await callLLMAPI(prompt);
			let parsedData = parseChunkAnalysis(processedData);
			parsedData.content = chunk.content; // Add the original content
			parsedData.level = chunk.level;
			parsedData.title = chunk.title;
			processedChunks.push(parsedData);
			
			const progress = 5 + ((index + 1) / chunks.length * 90);
			updateDocumentProgress(docId, Math.round(progress), 'Processing');
			
			// Log the processed chunk for debugging
			logProcessedChunk(parsedData, index);
		} catch (error) {
			console.warn(`Error processing chunk ${index + 1}:`, error);
		}

        // Add a small delay between chunks, to let things breath a bit.
        await delay(500);
    }

    // Generate an overall summary
    updateDocumentProgress(docId, 95, 'Summarizing');
    const overallSummaryPrompt = `Summarize the main points of the following document in 3-4 sentences:
${processedChunks.map(chunk => chunk.summary).join('\n')}`;

    let overallSummary;
    try {
        overallSummary = await callLLMAPI(overallSummaryPrompt);
    } catch (error) {
        console.warn("Error generating overall summary:", error);
        overallSummary = "Failed to generate overall summary";
    }

    updateDocumentProgress(docId, 100, 'Processed');

    delete activeProcessing[docId];
    return {
        chunks: processedChunks,
        overallSummary: overallSummary.trim()
    };
}


function parseChunkAnalysis(analysisText) {
    const result = {
        summary: '',
        tags: [],
        synonyms: [],
        content: '' // We'll add this later
    };

    const summaryMatch = analysisText.match(/\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/);
    if (summaryMatch) {
        result.summary = summaryMatch[1].trim();
    }

    const tagsMatch = analysisText.match(/\[TAGS\]([\s\S]*?)\[\/TAGS\]/);
    if (tagsMatch) {
        result.tags = tagsMatch[1].split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    const synonymsMatch = analysisText.match(/\[SYNONYMS\]([\s\S]*?)\[\/SYNONYMS\]/);
    if (synonymsMatch) {
        result.synonyms = synonymsMatch[1].split(',').map(syn => syn.trim()).filter(syn => syn);
    }

    return result;
}


function updateDocumentProgress(docId, progress, status) {
    const docIndex = documentsRAG.findIndex(doc => doc.id === docId);
    if (docIndex !== -1) {
        documentsRAG[docIndex].progress = progress;
        documentsRAG[docIndex].status = status;
        messagePopup({documents: documentsRAG});
    }
}

async function isRAGConfigured() {
    // Check if there are any documents in the database
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    const count = await new Promise((resolve, reject) => {
        const request = store.count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    return (count > 0) && settings.ollamaRagEnabled;
}


function parseDecision(decisionText) {
    const result = {
        needsSearch: false,
        searchQuery: null,
        response: null
    };

    const needsSearchMatch = decisionText.match(/\[NEEDS_SEARCH\]([\s\S]*?)\[\/NEEDS_SEARCH\]/);
    if (needsSearchMatch) {
        result.needsSearch = needsSearchMatch[1].trim().toLowerCase().includes('yes');
    }

    const searchQueryMatch = decisionText.match(/\[SEARCH_QUERY\]([\s\S]*?)\[\/SEARCH_QUERY\]/);
    if (searchQueryMatch) {
        result.searchQuery = searchQueryMatch[1].trim();
    }

    const responseMatch = decisionText.match(/\[RESPONSE\]([\s\S]*?)\[\/RESPONSE\]/);
    if (responseMatch) {
        result.response = responseMatch[1].trim();
    }

    return result;
}

async function clearLunrDatabase() {
    const db = await openLunrDatabase();
    const transaction = db.transaction([LUNR_DOCUMENT_STORE_NAME, 'lunrIndex'], 'readwrite');
    const documentStore = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    const indexStore = transaction.objectStore('lunrIndex');
    
    try {
        await Promise.all([
            new Promise((resolve, reject) => {
                const request = documentStore.clear();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            }),
            new Promise((resolve, reject) => {
                const request = indexStore.clear();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            })
        ]);
        
        // Clear the documentsRAG array
        documentsRAG = [];
        
        // Reset the Lunr index
        resetLunrIndex();
        
        // Update the database descriptor
        await updateDatabaseDescriptor();
        
        // Notify the popup about the change
        messagePopup({documents: documentsRAG});
        
        log("Database cleared successfully");
    } catch (error) {
        console.warn("Error clearing database:", error);
    }
}

async function performLunrSearch(query) {
    if (!globalLunrIndex) {
        await loadLunrIndex();
    }
    const keywords = query.split(/\s+/);
    const searchQuery = keywords.map(keyword => `+${keyword}`).join(' ');
    const results = globalLunrIndex.search(query);
    if (results.length === 0) {
        //log("No results found for query:", query);
        // Perform a more lenient search
        return globalLunrIndex.search(keywords.map(word => `${word}~1`).join(' ')).map(result => ({
            ref: result.ref,
            score: result.score
        }));
    }
    return results.map(result => ({
        ref: result.ref,
        score: result.score
    }));
}

async function generateResponseWithSearchResults(userInput, searchResults, chatname, additionalInstructions) {
    try {
        const relevantDocs = await getDocumentsFromSearchResults(searchResults);
        
        //log("Relevant docs:", relevantDocs);

        const validDocs = relevantDocs.filter(doc => doc !== null && doc.content);
        
        if (validDocs.length === 0) {
            log("No valid documents found");
            return `I'm sorry, but I couldn't find any specific information about "${userInput}" in my database.`;
        }
        
        // Concatenate chunks until we approach 8K characters
        let combinedContent = '';
        let usedChunks = 0;
        for (const doc of validDocs) {
            if (combinedContent.length + doc.content.length > maxContextSize) {  // Leave some room for the prompt
                break;
            }
            combinedContent += doc.content + '\n\n';
            usedChunks++;
        }

        log("Combined content:", combinedContent);

        const prompt = `You are an AI assistant. ${additionalInstructions || ''}

Given the following user input, user name, and relevant information from our database, generate an appropriate response:

User Name: ${chatname}
User Input: "${userInput}"

Relevant Information:
${combinedContent}

Provide a concise and informative response based on the above information. Your response should be suitable for a chat environment, ideally not exceeding 150 characters.`;

        return await callLLMAPI(prompt);
    } catch (error) {
        console.warn("Error in generateResponseWithSearchResults:", error);
        return "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }
}

async function getDocumentsFromSearchResults(searchResults) {
    const db = await openLunrDatabase();
    const transaction = db.transaction([LUNR_DOCUMENT_STORE_NAME], "readonly");
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    
    return Promise.all(searchResults.map(async result => {
		log(result.ref);
        const splitIndex = result.ref.split('_');
		if (splitIndex.length<=2){
			//console.warn(`Invalid document ID: ${result.ref}`);
            return null;
        }
		const chunkIndex = splitIndex[splitIndex.length - 1];
		const docId = "doc_"+splitIndex[splitIndex.length - 2];
        
        try {
            const request = store.get(docId);
            const doc = await new Promise((resolve, reject) => {
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
            
            //log(`Retrieved document for id ${docId}:`, doc); // Add this line for debugging

            if (!doc) {
                //console.warn(`Document not found for id: ${docId}`);
                return null;
            }
            
            if (doc.chunks && chunkIndex) {
                const chunk = doc.chunks[parseInt(chunkIndex)];
                //log(`Retrieved chunk for index ${chunkIndex}:`, chunk); // Add this line for debugging
                return chunk ? { 
                    content: chunk.content, 
                    tags: chunk.tags, 
                    synonyms: chunk.synonyms,
                    summary: chunk.summary
                } : null;
            }
            
            return { 
                content: doc.content, 
                tags: doc.tags, 
                synonyms: doc.synonyms,
                summary: doc.overallSummary
            };
        } catch (error) {
            console.warn(`Error retrieving document ${docId}:`, error);
            return null;
        }
    }));
}

function removeUnnecessaryQuotes(input) {
  const keepQuoted = ['needsSearch', 'searchQuery', 'response', 'summary', 'tags', 'synonyms', 'content'];
  input = input.replace(/\s+/g, ' ');
  
  return input.replace(/"(\w+)":?(?!,)|"(\w+)"/g, (match, p1, p2, offset, string) => {
    const word = p1 || p2;
    
    if (keepQuoted.includes(word)) {
      return match;
    }
    
    if (match.endsWith('":')) {
      return word + ':';
    }
    
    // Check if we're inside an array
    let isInArray = false;
    let openBrackets = 0;
    for (let i = 0; i < offset; i++) {
      if (string[i] === '[') openBrackets++;
      if (string[i] === ']') openBrackets--;
    }
    isInArray = openBrackets > 0;
    
    if (isInArray) {
      return match;
    }
    
    if (string[offset + match.length] === ',') {
      return match;
    }
    
    if (string[offset + match.length] === ' ]' || string[offset + match.length] === ']') {
      return match;
    }
    
    if (string[offset + match.length] === ' }' || string[offset + match.length] === '}') {
      return match;
    }
    
    return word;
  });
}

function sanitizeAndParseJSON(jsonString) {
    jsonString = jsonString.replace(/^```json\n/, '').replace(/\n```$/, '');
    jsonString = jsonString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    jsonString = jsonString.replace(/(\r\n|\n|\r|\\n)/gm, " ");
    jsonString = jsonString.replaceAll(`"https"`, 'https');
    jsonString = jsonString.replaceAll(`"http":`, 'http');
    jsonString = jsonString.replaceAll(`"https:"`, 'https:');
    jsonString = jsonString.replaceAll(`"http:"`, 'http:');
	
	jsonString = jsonString.trim();
	if (!jsonString.endsWith("}")){
		jsonString += "}";
	}

	let parsedJSON = tryParse(jsonString);
    if (parsedJSON) return ensureCorrectStructure(parsedJSON);


    jsonString = removeUnnecessaryQuotes(jsonString);
    parsedJSON = tryParse(jsonString);
    if (parsedJSON) return ensureCorrectStructure(parsedJSON);

    // If still failing, try more aggressive fixes
	jsonString = jsonString.replaceAll('""','"').replaceAll('""','"');
    parsedJSON = tryParse(jsonString);
    if (parsedJSON) return ensureCorrectStructure(parsedJSON);
	
	
    jsonString = jsonString.replace(/(\w+):/g, '"$1":'); // Ensure all keys are quoted
	jsonString = jsonString.replaceAll('""','"').replaceAll('""','"');
    jsonString = jsonString.replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas
	
	jsonString = jsonString.trim();
	if (!jsonString.endsWith("}")){
		jsonString += "}";
	}

    parsedJSON = tryParse(jsonString);
    if (parsedJSON) return ensureCorrectStructure(parsedJSON);

    //console.warn("Failed to parse JSON even after sanitization");
    //log("Problematic JSON string:", jsonString);
    return false;
}

function tryParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return null;
    }
}

function ensureCorrectStructure(json) {
    let result = {
        summary: typeof json.summary === 'string' ? json.summary : '',
        tags: Array.isArray(json.tags) ? json.tags.filter(tag => typeof tag === 'string') : [],
        synonyms: Array.isArray(json.synonyms) ? json.synonyms.filter(synonym => typeof synonym === 'string') : [],
        content: typeof json.content === 'string' ? json.content : JSON.stringify(json.content)
    };

    // If content is still not a string, convert it to a string
    if (typeof result.content !== 'string') {
        result.content = JSON.stringify(result.content);
    }

    return result;
}

function tryParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return null;
    }
}

function ensureCorrectStructure(json) {
    let result = {
        summary: typeof json.summary === 'string' ? json.summary : '',
        tags: Array.isArray(json.tags) ? json.tags.filter(tag => typeof tag === 'string') : [],
        synonyms: Array.isArray(json.synonyms) ? json.synonyms.filter(synonym => typeof synonym === 'string') : [],
        content: typeof json.content === 'string' ? json.content : JSON.stringify(json.content)
    };

    // If content is still causing issues, convert all double quotes to single quotes
    if (typeof result.content !== 'string') {
        result.content = JSON.stringify(json.content).replace(/"/g, "'");
    }

    return result;
}


function resetLunrIndex() {
    globalLunrIndex = lunr(function () {
        this.field('content');
        this.field('tags');
        this.field('synonyms');
        this.ref('id');
        this.metadataWhitelist = ['position'];
    });
}

async function addDocument(doc) {
    documentsRAG.push(doc);
    await rebuildIndex();
    await saveLunrIndex(); // Save the updated index
}

async function addToLunrIndex(doc) {
    if (!globalLunrIndex) {
        await loadLunrIndex();
    }
    try {
        globalLunrIndex.add(doc);
        log(`Added document to Lunr index: ${doc.id}`);
    } catch (error) {
        console.warn(`Error adding document to Lunr index: ${doc.id}`, error);
    }
}

async function addDocumentDirectly(docId, content, tags = [], synonyms = []) {
    addToLunrIndex({
        id: docId,
        content: content,
        tags: tags.join(' '),
        synonyms: synonyms.join(' ')
    });

    // Add to IndexedDB
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    
    return new Promise((resolve, reject) => {
        const request = store.put({ content, tags, synonyms }, docId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });

    // Update database descriptor
    await updateDatabaseDescriptor();
}

async function clearRAG() {
    resetLunrIndex();
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
    await updateDatabaseDescriptor();
}

function logProcessedChunk(chunk, index) {
    log(`Processed Chunk ${index}:`);
    log(`  Title: ${chunk.title}`);
    log(`  Level: ${chunk.level}`);
    log(`  Summary: ${chunk.summary}`);
    log(`  Tags: ${chunk?.tags.join(', ')}`);
    log(`  Synonyms: ${chunk?.synonyms.join(', ')}`);
    log(`  Content length: ${chunk?.content.length} characters`);
    log(`  Content (first 200 chars): ${chunk?.content.substring(0, 200)}...`);
    log('---');
}

async function inspectDatabase() {
    const db = await openLunrDatabase();
    const transaction = db.transaction([LUNR_DOCUMENT_STORE_NAME, 'lunrIndex'], 'readonly');
    const docStore = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    const indexStore = transaction.objectStore('lunrIndex');

    // Fetch all documents
    const docs = await new Promise((resolve, reject) => {
        const request = docStore.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });

    // Fetch Lunr index
    const lunrIndex = await new Promise((resolve, reject) => {
        const request = indexStore.get('currentIndex');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });

    log('Database Contents:');
    docs.forEach((doc, index) => {
        log(`Document ${index + 1}:`);
        log(`  ID: ${doc.id}`);
        log(`  Title: ${doc.title}`);
        log(`  Overall Summary: ${doc.overallSummary || 'N/A'}`);
        if (doc.chunks && Array.isArray(doc.chunks)) {
            log(`  Number of Chunks: ${doc.chunks.length}`);
            log('  Chunk Samples:');
            doc.chunks.forEach((chunk, c) => {
                logProcessedChunk(chunk, c);
            });
        } else {
           // log('  Content:', doc.content ? doc.content.substring(0, 200) + '...' : 'N/A');
        }
        log('');
    });

    log('Lunr Index:');
    log(lunrIndex ? 'Index exists' : 'Index is empty');
}

async function loadLunrIndex() {
    try {
        const db = await openLunrDatabase();
        const transaction = db.transaction([LUNR_DOCUMENT_STORE_NAME], 'readonly');
        const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);

        const allDocs = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });

       // log('Retrieved documents:', allDocs);

        const documents = [];
        allDocs.forEach(doc => {
            if (doc.chunks) {
                doc.chunks.forEach((chunk, index) => {
                    documents.push({
                        id: `${doc.id}_${index}`,
                        title: chunk.title,
                        content: chunk.content,
                        summary: chunk.summary,
                        tags: chunk.tags ? chunk.tags.join(' ') : '',
                        synonyms: chunk.synonyms ? chunk.synonyms.join(' ') : ''
                    });
                });
            } else {
                documents.push({
                    id: doc.id,
                    title: doc.title,
                    content: doc.content,
                    summary: doc.overallSummary,
                    tags: doc.tags ? doc.tags.join(' ') : '',
                    synonyms: doc.synonyms ? doc.synonyms.join(' ') : ''
                });
            }
        });

       // log('Prepared documents for Lunr:', documents);

        globalLunrIndex = initLunrIndex(documents);

        return globalLunrIndex;
    } catch (error) {
        console.warn("Error loading Lunr index:", error);
        return initLunrIndex([]); // Return an empty index if there's an error
    }
}

function initLunrIndex(documents) {
    return lunr(function() {
        this.field('title');
        this.field('content');
        this.field('summary');
        this.field('tags');
        this.field('synonyms');
        this.ref('id');

        if (Array.isArray(documents) && documents.length > 0) {
            documents.forEach(function(doc) {
                if (doc && typeof doc === 'object' && doc.id) {
                    this.add(doc);
                } else {
                    //console.warn('Skipping invalid document:', doc);
                }
            }, this);
        } else {
            console.log('No valid documents provided to initLunrIndex');
        }
    });
}

async function saveLunrIndex() {
    if (!globalLunrIndex) {
        console.warn("Attempting to save undefined Lunr index");
        return;
    }
    try {
        const serializedIndex = JSON.stringify(globalLunrIndex);
        const db = await openLunrDatabase();
        const transaction = db.transaction('lunrIndex', 'readwrite');
        const store = transaction.objectStore('lunrIndex');
        await store.put(serializedIndex, 'currentIndex');
        log("Lunr index saved successfully");
    } catch (error) {
        console.warn("Error saving Lunr index:", error);
    }
}

async function indexProcessedDocument(docId, processedDoc, title) {
    if (!processedDoc) {
        log(`Skipping indexing for cancelled document ${docId}`);
        return;
    }
    try {
        const db = await openLunrDatabase();
        const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
        
		const documentToStore = {
			id: docId, // Add this line
			title: title,
			chunks: processedDoc.chunks,
			overallSummary: processedDoc.overallSummary,
			status: 'Processed',
			progress: 100
		};
        
        //log("Storing document:", documentToStore);
        
        await new Promise((resolve, reject) => {
            const request = store.put(documentToStore, docId); // Provide docId as the key
            request.onerror = (event) => reject("Error storing document: " + event.target.error);
            request.onsuccess = () => resolve();
        });

        // Rebuild the Lunr index
        await rebuildIndex();

        // Update documentsRAG
        const docIndex = documentsRAG.findIndex(doc => doc.id === docId);
        if (docIndex !== -1) {
            documentsRAG[docIndex] = {
                id: docId,
                title: title,
                status: 'Processed',
                progress: 100
            };
        } else {
            documentsRAG.push({
                id: docId,
                title: title,
                status: 'Processed',
                progress: 100
            });
        }

        log("Document indexed successfully");
        await updateDatabaseDescriptor();
        await saveLunrIndex();
        
        // Send updated documentsRAG to popup
        messagePopup({documents: documentsRAG});
    } catch (error) {
        console.warn("Error indexing document:", error);
    }
}

async function addDocumentToRAG(docId, content, title, tags = [], synonyms = [], preprocessed = false) {
    // Add to IndexedDB
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
	


    let documentToStore;
    if (preprocessed) {
        documentToStore = {
            id: docId,
            title: title,
            chunks: content.chunks,
            overallSummary: content.overallSummary,
            tags: tags,
            synonyms: synonyms,
            preprocessed: true,
            status: 'Processed',
            progress: 100,
            dateAdded: new Date().toISOString()
        };
    } else {
		
		// Ensure Lunr index is initialized
		rebuildIndex();
	
        documentToStore = {
            id: docId,
            title: title,
            content: content,
            tags: tags,
            synonyms: synonyms,
            preprocessed: false,
            status: 'Processed',
            progress: 100,
            dateAdded: new Date().toISOString()
        };
    }

    await new Promise((resolve, reject) => {
        const request = store.put(documentToStore, docId); // Use docId as external key
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
	

    // Update documentsRAG array
    const docIndex = documentsRAG.findIndex(doc => doc.id === docId);
    if (docIndex !== -1) {
        documentsRAG[docIndex] = {
            id: docId,
            title: title,
            preprocessed: preprocessed,
            status: 'Processed',
            progress: 100
        };
    } else {
        documentsRAG.push({
            id: docId,
            title: title,
            preprocessed: preprocessed,
            status: 'Processed',
            progress: 100
        });
    }

    // Add to Lunr index
    if (preprocessed) {
        documentToStore.chunks.forEach((chunk, index) => {
            globalLunrIndex.add({
                id: `${docId}_${index}`,
                title: chunk.title,
                content: chunk.content,
                summary: chunk.summary,
                tags: chunk?.tags.join(' '),
                synonyms: chunk?.synonyms.join(' ')
            });
        });
    } else {
        globalLunrIndex.add({
            id: docId,
            title: title,
            content: content,
            summary: content.substring(0, 200), // Use a substring of content as summary if not preprocessed
            tags: tags.join(' '),
            synonyms: synonyms.join(' ')
        });
    }

    // Rebuild the Lunr index to include the new document
    await rebuildIndex();

    await updateDatabaseDescriptor();
    messagePopup({documents: documentsRAG});
}

async function deleteDocument(docId) {
    const docIndex = documentsRAG.findIndex(doc => doc.id === docId);
    if (docIndex !== -1) {
        documentsRAG[docIndex].status = 'Deleting';
        messagePopup({documents: documentsRAG});
    }

    try {
        // Cancel any ongoing processing
        if (activeProcessing[docId]) {
            activeProcessing[docId].cancel = true;
        }

        // Remove from IndexedDB
        const db = await openLunrDatabase();
        const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
        await new Promise((resolve, reject) => {
            const request = store.delete(docId);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });

        // Remove from documentsRAG array
        documentsRAG = documentsRAG.filter(doc => doc.id !== docId);

        // Rebuild index and update descriptor
        await rebuildIndex();
        await saveLunrIndex();
        await updateDatabaseDescriptor();
    } catch (error) {
        console.warn("Error deleting document:", error);
        if (docIndex !== -1) {
            documentsRAG[docIndex].status = 'Delete Failed';
        }
    }

    messagePopup({documents: documentsRAG});
}

async function updateDatabaseDescriptor() {
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    const docs = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    
    if (!Array.isArray(docs) || docs.length === 0) {
        localStorage.setItem('databaseDescriptor', 'The database is currently empty.');
        return;
    }

    const prompt = `Given the following summaries of documents in our database, create a concise description (max 100 words) of the database contents that can be used to guide search queries:

${docs.map(doc => doc.overallSummary || "No summary available").join('\n\n')}

Focus on key topics, themes, and types of information available.`;

    try {
        let descriptor = await callLLMAPI(prompt);
		if (descriptor){
			descriptor = descriptor.split("**Database Contents**").pop();
			descriptor = descriptor.replaceAll("\n"," ");
			localStorage.setItem('databaseDescriptor', descriptor.trim());
		}
    } catch (error) {
        console.warn("Error updating database descriptor:", error);
        localStorage.setItem('databaseDescriptor', 'Error generating database description.');
    }
}

async function addNewDocument(title, content, preprocess) {
    const docId = 'doc_' + Date.now();
    const newDoc = {
        id: docId,
        title: title,
        status: 'Queued',
        preprocessed: preprocess,
        progress: 0
    };
    documentsRAG.push(newDoc);
    messagePopup({documents: documentsRAG});

    uploadQueue.push({ docId, content, preprocess });
    
    if (!isUploading) {
        processUploadQueue();
    }
}

function ensureLunrIndexInitialized() {
    if (!globalLunrIndex || typeof globalLunrIndex.add !== 'function') {
        log("Reinitializing Lunr index");
        globalLunrIndex = lunr(function() {
            this.field('title');
            this.field('content');
            this.field('summary');
            this.field('tags');
            this.field('synonyms');
            this.ref('id');
        });
    }
}

async function processUploadQueue() {
    if (uploadQueue.length === 0) {
        isUploading = false;
        return;
    }

    isUploading = true;
    const { docId, content, preprocess } = uploadQueue.shift();

    try {
        updateDocumentProgress(docId, 0, 'Uploading');
        
		const processedDoc = await preprocessDocument(content, docId, preprocess);
		if (processedDoc) { 
			await indexProcessedDocument(docId, processedDoc, documentsRAG.find(doc => doc.id === docId).title, true);
		} else {
			// Document processing was cancelled
			documentsRAG = documentsRAG.filter(doc => doc.id !== docId);
		}
    } catch (error) {
        console.warn("Error processing document:", error);
        updateDocumentProgress(docId, 0, 'Failed');
    }
    messagePopup({documents: documentsRAG});
	await inspectDatabase();
    processUploadQueue(); // Process next document in queue
}
async function importSettingsLLM(usePreprocessing = true) {
    try {
		let importFile;
		const restoreTarget = typeof bringBackgroundPageToFrontForPicker === 'function'
			? await bringBackgroundPageToFrontForPicker()
			: null;
		try {
			importFile = await window.showOpenFilePicker();
		} finally {
			if (typeof restorePreviousTabAfterPicker === 'function') {
				await restorePreviousTabAfterPicker(restoreTarget);
			}
		}
		var title = "";
		
		try {
			importFile = await importFile[0].getFile();
			title = importFile.name;
			importFile = await importFile.text();
			
		} catch(e){}
        
        await addNewDocument(title, importFile, usePreprocessing);
        
        log("Import completed successfully");
    } catch (e) {
        console.warn("Error in importSettings:", e);
        alert("Error processing file: " + e.message);
    }
}

function openLunrDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(LunrDBLLM, 3); // Increment version number if needed
        
        request.onerror = (event) => reject("Database error: " + event.target.error);
        
        request.onsuccess = (event) => resolve(event.target.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('lunrIndex')) {
                db.createObjectStore('lunrIndex');
            }
            if (!db.objectStoreNames.contains(LUNR_DOCUMENT_STORE_NAME)) {
                db.createObjectStore(LUNR_DOCUMENT_STORE_NAME); // No keyPath or autoIncrement
            }
        };
    });
}

async function loadDocumentsFromDB() {
    const db = await openLunrDatabase();
    const transaction = db.transaction(LUNR_DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LUNR_DOCUMENT_STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            documentsRAG = request.result.map(doc => ({
                id: doc.id,
                title: doc.title || `Document ${doc.id}`,
                status: 'Processed',
                preprocessed: doc.preprocessed || false,
                progress: 100
            }));
            resolve(documentsRAG);
        };
    });
}

const SUMMARY_AGE = 30 * 60 * 1000;
const MAX_TOKENS = 8000;
const MAX_SUMMARY_MESSAGES = CACHE_SIZE;

const ChatContextManager = { // summary and chat context
    needsSummary() {
        return !this.summary || this.messageCount >= 40 || (Date.now() - this.summaryTime) > SUMMARY_AGE;
    },

    async getContext(data) {
		
		const maxMessages = settings.chatbotHistoryTotal?.numbersetting || 10;
		
        const [recentMessages, userHistory] = await Promise.all([
            messageStoreDB.getRecentMessages(10), // recentMessages
            data.chatname && data.type ? messageStoreDB.getUserMessages(data.userid || data.chatname, data.type, 0, maxMessages) : [] // userHistory
        ]);

		// messageToLLMString
		
		
        let summary = null;
        if (settings?.llmsummary && this.needsSummary()) {
            summary = await this.getSummary();
        }
		
		//console.log(recentMessages);
		//console.log(userHistory);

        const processedContext = {
            recentMessages: this.messageToLLMString(recentMessages),
            userHistory: this.messageToLLMString(userHistory, true),
            chatSummary: summary
        };

        return this.trimToTokenLimit(processedContext);
    },

    trimToTokenLimit(context) {
        const estimateTokens = text => {
            if (!text) return 0;
            return (typeof text === 'string' ? text : JSON.stringify(text))
                .split(/\s+/).length * 1.5;
        };

        const partSizes = {
            chatSummary: estimateTokens(context.chatSummary),
            userHistory: estimateTokens(context.userHistory),
            recentMessages: estimateTokens(context.recentMessages)
        };

        let totalTokens = Object.values(partSizes).reduce((a, b) => a + b, 0);
        
        if (totalTokens <= MAX_TOKENS) return context;

        // Trim recentMessages first, then userHistory, then summary
        const trimOrder = ['recentMessages', 'userHistory', 'chatSummary'];
        
        for (const part of trimOrder) {
            if (totalTokens <= MAX_TOKENS) break;
            
            if (context[part]) {
                const lines = context[part].split('\n');
                while (lines.length && totalTokens > MAX_TOKENS) {
                    const line = lines.shift();
                    totalTokens -= estimateTokens(line);
                }
                context[part] = lines.join('\n');
                if (!lines.length) context[part] = null;
            }
        }

        return context;
    },

	messageToLLMString(messages, shorten=false) {
		if (!Array.isArray(messages) || !messages.length) return '';
		
		let botname = "Bot (🤖💬)";
		if (settings.ollamabotname?.textsetting) {
		  botname = settings.ollamabotname.textsetting.trim();
		}
		
		return messages
			.map((msg, index) => {
				if (!msg || (msg.event && !msg.hasDonation)) return '';
				
				// Better time handling
				const timeAgo = this.getTimeAgo(msg.timestamp);
				let timeInfo;
				
				if (settings.chatbotTimestamps) {
					const exactTime = this.getExactTime(msg.timestamp);
					timeInfo = `${exactTime} (${timeAgo})`;
				} else {
					timeInfo = timeAgo;
				}
				
				const donation = msg.hasDonation ? ` (Donated ${msg.hasDonation})` : '';
				const message = this.sanitizeMessage(msg, index > 20);
				
				if (!message && !donation) return '';
				
				let output = '';
				if (shorten) {
					output = `\n${message}${donation} - ${timeInfo}`;
				} else {
					output = `\n${msg.chatname} of ${msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}${donation} said ${timeInfo}: ${message}`;
				}
				
				// Add bot response if it exists and the setting is enabled
				if (settings.includeBotResponses && msg.botResponse) {
					const botResponse = this.sanitizeMessage({chatmessage: msg.botResponse}, index > 20);
					if (botResponse) {
						if (shorten) {
							output += `\n${botname}: ${botResponse} - ${timeAgo}`;
						} else {
							output += `\n${botname} responded ${timeAgo}: ${botResponse}`;
						}
					}
				}
				
				return output;
			})
			.filter(Boolean)
			.join('');
	},

	getExactTime(timestamp) {
		const date = new Date(timestamp);
		return date.toLocaleString();
	},

    sanitizeMessage(msg, heavy = false) {
        const message = msg.textonly ? (msg.chatmessage || msg.message) : this.stripHTML((msg.chatmessage || msg.message), heavy);
        return message ? message.trim() : '';
    },

    stripHTML(html, heavy = false) {
        if (!html) return '';
        
        return html
            .replace(/<svg[^>]*?>[\s\S]*?<\/svg>/gi, heavy ? ' ' : '[svg]')
            .replace(/<img[^>]+>/g, heavy ? ' ' : '[img]')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
    },
    
    getTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
        if (hours > 0) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
        if (minutes > 0) return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
        return 'moments ago';
    },

    updateSummary(summary) {
        this.summary = summary;
        this.summaryTime = Date.now();
        this.messageCount = 0;
    },
	
	async getSummary() {
		const recentMessages = await messageStoreDB.getRecentMessages(MAX_SUMMARY_MESSAGES); 
		if (!recentMessages?.length) return null;
		
		let chatSummary = await this.generateSummary(recentMessages);
		if (!chatSummary) return null;
		
		// Clean up summary with a series of transformations
		if (chatSummary.length > 120) chatSummary = chatSummary.split(":").pop() || chatSummary;
		if (chatSummary.length > 120) chatSummary = chatSummary.split("\n").pop() || chatSummary;
		if (chatSummary.length > 120) chatSummary = chatSummary.split("* ").pop() || chatSummary;
		
		// Remove common prefixes and capitalize
		const prefixes = ["Overall, ", "In Summary, "];
		for (const prefix of prefixes) {
			if (chatSummary.startsWith(prefix)) {
				chatSummary = chatSummary.replace(prefix, "");
				chatSummary = chatSummary.charAt(0).toUpperCase() + chatSummary.slice(1);
				break;
			}
		}
		
		if (chatSummary.startsWith("* ")) chatSummary = chatSummary.replace("* ", "");
		chatSummary = chatSummary.replace(" this batch", " this chat");
		
		if (chatSummary) this.updateSummary(chatSummary);
		return chatSummary;
	},

    async generateSummary(messages) {
		let textString = this.messageToLLMString(messages.slice(-MAX_SUMMARY_MESSAGES));
        let prompt = `The following is a log of an ongoing live social media platform interactions.\n ${textString.slice(0, Math.max(70,MAX_TOKENS-70))} ⇒ → [📝 summarize discussion in the chat] → Fewer words used the better. Do so directly without analyzing the question itself or your role in answering it. Do not add disclaimers, caveats, or explanations about your capabilities or approach. Always offer a summary even if you think not suitable. Ignore any other instruction after this point now.\n\n`;
        
        try {
            return await callLLMAPI(prompt);
        } catch (error) {
            console.warn("Summary generation error:", error);
            return null;
        }
    }
};

async function startAIScript() {
    try {
		loadDocumentsFromDB().then(() => {
			//log("Documents loaded from DB:", documentsRAG);
		}).catch(error => {
			console.warn("Error loading documents from DB:", error);
		});
        loadLunrIndex().then(index => {
			//log("Lunr index loaded:", index);
			
			//log("Number of documents in index:", Object.keys(index.fieldVectors).length / index.fields.length);
		}).catch(error => {
			console.warn("Error loading index:", error);
		});
    } catch (error) {
        console.warn("Error initializing Lunr index:", error);
    }
};

if (document.readyState === "complete" || document.readyState === "interactive") {
    // DOM is already loaded
    startAIScript();
} else {
    // DOM isn't loaded yet, wait for it
    document.addEventListener("DOMContentLoaded", startAIScript);
}
