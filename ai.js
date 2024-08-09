// this file depends on background.js
// this file contains the LLM / RAG component

let globalLunrIndex = null;
let documentsRAG = []; // Store all documents here
const LunrDBLLM = "LunrDBLLM";
const DOCUMENT_STORE_NAME = 'documents';
const activeProcessing = {};
const uploadQueue = [];
let isUploading = false;
let lunrIndexPromise;
const maxContextSize = 31000;
const maxContextSizeFull = 32000;

function getFirstAvailableModel() {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
		
		let ollamaendpoint = "http://localhost:11434";
		if (settings.ollamaendpoint && settings.ollamaendpoint.textsetting){
			ollamaendpoint = settings.ollamaendpoint.textsetting;
		}
		
        xhr.open('GET', ollamaendpoint+'/api/tags', true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                const datar = JSON.parse(xhr.responseText);
                if (datar && datar.models && datar.models.length > 0) {
                    resolve(datar.models[0].name);
                } else {
                    reject(new Error('No models available'));
                }
            } else {
                reject(new Error('Failed to fetch models'));
            }
        };
        xhr.onerror = function() {
            reject(new Error('Network error while fetching models'));
        };
        xhr.send();
    });
}

async function rebuildIndex() {
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
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

async function callOllamaAPI(prompt) {
    const ollamaendpoint = settings.ollamaendpoint?.textsetting || "http://localhost:11434";
    const ollamamodel = settings.ollamamodel?.textsetting || "llama3.1:latest";

    try {
		if (postNode){
			let body = {
				model: ollamamodel,
				prompt: prompt,
				stream: false
			};
			let data = await postNode(`${ollamaendpoint}/api/generate`, body, (headers = { "Content-Type": 'application/json' }));
			console.log(data);
			data = JSON.parse(data);
			return data.response;
		} else {
			const response = await fetch(`${ollamaendpoint}/api/generate`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: ollamamodel,
					prompt: prompt,
					stream: false
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			
			//console.log("Ollama API response:", data);
			return data.response; // Return only the 'response' field
		}
    } catch (error) {
        console.error("Error in callOllamaAPI:", error);
        throw new Error("Failed to call Ollama API: " + error.message);
    }
}

let isProcessing = false;
const lastResponseTime = {};


async function processMessageWithOllama(data) {
    const currentTime = Date.now();
	if (isProcessing) { // nice.
        return;
    }
	isProcessing = true;
	
	let ollamaRateLimitPerTab = 5000;
	if (settings.ollamaRateLimitPerTab){
		ollamaRateLimitPerTab = Math.max(0, parseInt(settings.ollamaRateLimitPerTab.numbersetting)||0);
	}
    if (lastResponseTime[data.tid] && (currentTime - lastResponseTime[data.tid] < ollamaRateLimitPerTab)) {
		isProcessing = false;
        return; // Skip this message if we've responded recently
    }
    
    if (!data.chatmessage || data.chatmessage.startsWith("🤖💬:")) {
		isProcessing = false;
        return;
    }
    var cleanedText = data.chatmessage;
            
    if (!data.textonly) {
        cleanedText = decodeAndCleanHtml(cleanedText);
    }
	
	cleanedText = cleanedText.replace(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu, "").replace(/[\u200D\uFE0F]/g, ""); // Remove zero-width joiner and variation selector
	cleanedText = cleanedText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/gi, ""); // fail safe?
	cleanedText = cleanedText.replace(/[\r\n]+/g, "").replace(/\s+/g, " ").trim();
	
	if (!cleanedText) {
		isProcessing = false;
        return;
    }
    
    var score = levenshtein(cleanedText, lastSentMessage);
    if (score < 7) { // make sure bot doesn't respond to itself or to the host.
		isProcessing = false;
        return;
    }
	
    try {
		let additionalInstructions = "";
		if (settings.ollamaprompt){
			additionalInstructions = settings.ollamaprompt.textsetting;
		}
        const response = await processUserInput(cleanedText, data, additionalInstructions);
		log(response);
		if (response){
			const msg = {
				tid: data.tid,
				response: "🤖💬: " + response.trim()
			};
			processResponse(msg);
			lastResponseTime[data.tid] = Date.now();
		}
    } catch (error) {
        console.error("Error processing message:", error);
    } finally {
        isProcessing = false;
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
			const processedData = await callOllamaAPI(prompt);
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
			console.error(`Error processing chunk ${index + 1}:`, error);
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
        overallSummary = await callOllamaAPI(overallSummaryPrompt);
    } catch (error) {
        console.error("Error generating overall summary:", error);
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
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    const count = await new Promise((resolve, reject) => {
        const request = store.count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    return (count > 0) && settings.ollamaRagEnabled;
}

async function processUserInput(userInput, data={}, additionalInstructions) {
    try {
        if (await isRAGConfigured()) {
            const databaseDescriptor = localStorage.getItem('databaseDescriptor') || 'Database description not available.';
            
            const prompt = `You are an AI assistant with access to a database of information. ${additionalInstructions || ''}

Given the following user input, user name, and a description of the database contents, determine if a database search is necessary to respond appropriately. If a search is needed, provide relevant search keywords.

User Name: ${data.chatname || 'user'}
User Input: "${userInput}"

Database Description:
${databaseDescriptor}

For simple greetings, small talk, or queries that don't require specific information from the database, you may respond directly without a search.

If a search is needed, provide 3-5 relevant keywords or short phrases for the search, not a full question or sentence.

Please format your response exactly as follows, including the delimiters:

[NEEDS_SEARCH]
yes or no
[/NEEDS_SEARCH]

[SEARCH_QUERY]
keyword1 keyword2 keyword3
[/SEARCH_QUERY]

[RESPONSE]
Your direct response here if no search is needed, otherwise leave this blank
[/RESPONSE]

Ensure that if [NEEDS_SEARCH] is 'yes', [SEARCH_QUERY] is filled with keywords and [RESPONSE] is empty, and vice versa.
Do not include any other text or explanations outside these sections.`;

            const llmOutput = await callOllamaAPI(prompt);
            const decision = parseDecision(llmOutput);
            
            if (decision.needsSearch) {
                //console.log("Performing search with query:", decision.searchQuery);
                const searchResults = await performSearch(decision.searchQuery);
                //console.log("Search results:", searchResults);
                return await generateResponseWithSearchResults(userInput, searchResults, data.chatname || 'user', additionalInstructions);
            } else {
                return decision.response;
            }
        }  else {// If RAG is not configured, use the original instructions
            const prompt = `${additionalInstructions || 'You are an AI in a family-friendly public chat room. Your responses must follow these rules: If the message warrants a response (e.g., it\'s directed at you or you have a relevant comment), provide ONLY the exact text of your reply. No explanations, context, or meta-commentary. Keep responses brief and engaging, suitable for a fast-paced chat environment. If no response is needed or appropriate, output only "NO_RESPONSE". Never use quotation marks or any formatting around your response. Never indicate that you are an AI or that this is your response.'}

Respond to the following message:
User ${data.chatname || 'user'} says: ${userInput}

Your response:`;
			log(userInput);
            let response =  await callOllamaAPI(prompt);
			if (response.includes("NO_RESPONSE")){
				return false;
			}
			return response;
        }
    } catch (error) {
        console.error("Error processing user input:", error);
        return "I'm sorry, I encountered an error while processing your request.";
    }
}

function parseDecision(decisionText) {
    const result = {
        needsSearch: false,
        searchQuery: null,
        response: null
    };

    const needsSearchMatch = decisionText.match(/\[NEEDS_SEARCH\]([\s\S]*?)\[\/NEEDS_SEARCH\]/);
    if (needsSearchMatch) {
        result.needsSearch = needsSearchMatch[1].trim().toLowerCase() === 'yes';
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

async function clearDatabase() {
    const db = await openDatabase();
    const transaction = db.transaction([DOCUMENT_STORE_NAME, 'lunrIndex'], 'readwrite');
    const documentStore = transaction.objectStore(DOCUMENT_STORE_NAME);
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
        console.error("Error clearing database:", error);
    }
}

async function performSearch(query) {
    if (!globalLunrIndex) {
        await loadLunrIndex();
    }
    const keywords = query.split(/\s+/);
    const searchQuery = keywords.map(keyword => `+${keyword}`).join(' ');
    const results = globalLunrIndex.search(query);
    if (results.length === 0) {
        //console.log("No results found for query:", query);
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
        
        //console.log("Relevant docs:", relevantDocs);

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

        console.log("Combined content:", combinedContent);

        const prompt = `You are an AI assistant. ${additionalInstructions || ''}

Given the following user input, user name, and relevant information from our database, generate an appropriate response:

User Name: ${chatname}
User Input: "${userInput}"

Relevant Information:
${combinedContent}

Provide a concise and informative response based on the above information. Your response should be suitable for a chat environment, ideally not exceeding 150 characters.`;

        return await callOllamaAPI(prompt);
    } catch (error) {
        console.error("Error in generateResponseWithSearchResults:", error);
        return "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }
}

async function getDocumentsFromSearchResults(searchResults) {
    const db = await openDatabase();
    const transaction = db.transaction([DOCUMENT_STORE_NAME], "readonly");
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    
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
            
            //console.log(`Retrieved document for id ${docId}:`, doc); // Add this line for debugging

            if (!doc) {
                //console.warn(`Document not found for id: ${docId}`);
                return null;
            }
            
            if (doc.chunks && chunkIndex) {
                const chunk = doc.chunks[parseInt(chunkIndex)];
                //console.log(`Retrieved chunk for index ${chunkIndex}:`, chunk); // Add this line for debugging
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
            console.error(`Error retrieving document ${docId}:`, error);
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
    //console.log("Problematic JSON string:", jsonString);
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
        console.error(`Error adding document to Lunr index: ${doc.id}`, error);
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
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
    
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
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
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
    log(`  Tags: ${chunk.tags.join(', ')}`);
    log(`  Synonyms: ${chunk.synonyms.join(', ')}`);
    log(`  Content length: ${chunk.content.length} characters`);
    log(`  Content (first 200 chars): ${chunk.content.substring(0, 200)}...`);
    log('---');
}

async function inspectDatabase() {
    const db = await openDatabase();
    const transaction = db.transaction([DOCUMENT_STORE_NAME, 'lunrIndex'], 'readonly');
    const docStore = transaction.objectStore(DOCUMENT_STORE_NAME);
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

    console.log('Database Contents:');
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
           // console.log('  Content:', doc.content ? doc.content.substring(0, 200) + '...' : 'N/A');
        }
        log('');
    });

    log('Lunr Index:');
    log(lunrIndex ? 'Index exists' : 'Index is empty');
}

async function loadLunrIndex() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction([DOCUMENT_STORE_NAME], 'readonly');
        const store = transaction.objectStore(DOCUMENT_STORE_NAME);

        const allDocs = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });

       // console.log('Retrieved documents:', allDocs);

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

       // console.log('Prepared documents for Lunr:', documents);

        globalLunrIndex = initLunrIndex(documents);
        log('Lunr index initialized');

        return globalLunrIndex;
    } catch (error) {
        console.error("Error loading Lunr index:", error);
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
            log('No valid documents provided to initLunrIndex');
        }
    });
}

async function saveLunrIndex() {
    if (!globalLunrIndex) {
        console.error("Attempting to save undefined Lunr index");
        return;
    }
    try {
        const serializedIndex = JSON.stringify(globalLunrIndex);
        const db = await openDatabase();
        const transaction = db.transaction('lunrIndex', 'readwrite');
        const store = transaction.objectStore('lunrIndex');
        await store.put(serializedIndex, 'currentIndex');
        log("Lunr index saved successfully");
    } catch (error) {
        console.error("Error saving Lunr index:", error);
    }
}

async function indexProcessedDocument(docId, processedDoc, title) {
    if (!processedDoc) {
        log(`Skipping indexing for cancelled document ${docId}`);
        return;
    }
    try {
        const db = await openDatabase();
        const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(DOCUMENT_STORE_NAME);
        
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
        console.error("Error indexing document:", error);
    }
}

async function addDocumentToRAG(docId, content, title, tags = [], synonyms = [], preprocessed = false) {
    // Add to IndexedDB
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
	


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
                tags: chunk.tags.join(' '),
                synonyms: chunk.synonyms.join(' ')
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
        const db = await openDatabase();
        const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(DOCUMENT_STORE_NAME);
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
        console.error("Error deleting document:", error);
        if (docIndex !== -1) {
            documentsRAG[docIndex].status = 'Delete Failed';
        }
    }

    messagePopup({documents: documentsRAG});
}

async function updateDatabaseDescriptor() {
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
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
        let descriptor = await callOllamaAPI(prompt);
		descriptor = descriptor.split("**Database Contents**").pop();
		descriptor = descriptor.replaceAll("\n"," ");
        localStorage.setItem('databaseDescriptor', descriptor.trim());
    } catch (error) {
        console.error("Error updating database descriptor:", error);
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
        console.error("Error processing document:", error);
        updateDocumentProgress(docId, 0, 'Failed');
    }
    messagePopup({documents: documentsRAG});
	await inspectDatabase();
    processUploadQueue(); // Process next document in queue
}
async function importSettingsLLM(usePreprocessing = true) {
    try {
        var importFile = await window.showOpenFilePicker();
        importFile = await importFile[0].getFile();
        const fileContent = await importFile.text();
        const title = importFile.name;
        
        await addNewDocument(title, fileContent, usePreprocessing);
        
        log("Import completed successfully");
    } catch (e) {
        console.error("Error in importSettings:", e);
        alert("Error processing file: " + e.message);
    }
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(LunrDBLLM, 3); // Increment version number if needed
        
        request.onerror = (event) => reject("Database error: " + event.target.error);
        
        request.onsuccess = (event) => resolve(event.target.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('lunrIndex')) {
                db.createObjectStore('lunrIndex');
            }
            if (!db.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
                db.createObjectStore(DOCUMENT_STORE_NAME); // No keyPath or autoIncrement
            }
        };
    });
}

async function loadDocumentsFromDB() {
    const db = await openDatabase();
    const transaction = db.transaction(DOCUMENT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DOCUMENT_STORE_NAME);
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

async function someTestFunction() {
    await addDocumentDirectly('doc1', 'content', ['tag1', 'tag2'], ['syn1', 'syn2']);
    await updateDocument('doc1', 'new content', ['new tag'], ['new syn']);
	processUserInput("What is VDO.Ninja?");
    await deleteDocument('doc1');
}


document.addEventListener('DOMContentLoaded', async function() {
    try {
		loadDocumentsFromDB().then(() => {
			//console.log("Documents loaded from DB:", documentsRAG);
		}).catch(error => {
			console.error("Error loading documents from DB:", error);
		});
        loadLunrIndex().then(index => {
			//console.log("Lunr index loaded:", index);
			
			//console.log("Number of documents in index:", Object.keys(index.fieldVectors).length / index.fields.length);
		}).catch(error => {
			console.error("Error loading index:", error);
		});
    } catch (error) {
        console.error("Error initializing Lunr index:", error);
    }
});