/**
 * https://github.com/tensorflow/tfjs-examples/tree/master/sentiment
 *
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
 
var model;
var metadataJson;
var indexFrom;
var maxLen;
var wordIndex;
var vocabularySize;


// Global variable to track if TensorFlow.js is loaded
let tfLoaded = false;

// Function to load TensorFlow.js
async function loadTensorFlow() {
  if (tfLoaded) return;

  // Check if we're in a Chrome extension
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  let scriptUrl;
  if (isExtension) {
    // Use chrome.runtime.getURL for extensions
    scriptUrl = chrome.runtime.getURL('thirdparty/tf.min.js');
  } else {
    // Use a relative path for websites
    scriptUrl = './thirdparty/tf.min.js';
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => {
      console.log('TensorFlow.js loaded successfully');
      tfLoaded = true;
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load TensorFlow.js');
      reject(new Error('Failed to load TensorFlow.js'));
    };
    document.body.appendChild(script);
  });
}

async function loadSentimentAnalysis(){
	if (sentimentAnalysisLoaded!==false){return;}
	sentimentAnalysisLoaded = null;
	
	if (!tfLoaded) {
		try {
		  await loadTensorFlow();
		} catch (error) {
		  console.error('Error loading TensorFlow:', error);
		  return;
		}
	}
  
	model = await tf.loadLayersModel('./thirdparty/model.json');
	metadataJson = await fetch('./thirdparty/metadata.json');
	var sentimentMetadata = await metadataJson.json();
	indexFrom = sentimentMetadata['index_from'];
	maxLen = sentimentMetadata['max_len'];
	wordIndex = sentimentMetadata['word_index'];
	vocabularySize = sentimentMetadata['vocabulary_size'];
	console.log("model loaded");
	sentimentAnalysisLoaded = true;
}

function padSequences(
	sequences, padding = 'pre', truncating = 'pre', value = 0) {
		return sequences.map(seq => {
			if (seq.length > maxLen) {
				if (truncating === 'pre') {
				  seq.splice(0, seq.length - maxLen);
				} else {
				  seq.splice(maxLen, seq.length - maxLen);
				}
			}
			if (seq.length < maxLen) {
				const pad = [];
				for (let i = 0; i < maxLen - seq.length; ++i) {
				  pad.push(value);
				}
				if (padding === 'pre') {
				  seq = pad.concat(seq);
				} else {
				  seq = seq.concat(pad);
				}
			}
		return seq;
		}
	);
}
	
function inferSentiment(input_text) {
	if (!sentimentAnalysisLoaded){return;}
	const inputText = input_text.trim().toLowerCase().replace(/(\.|\,|\!)/g, '').split(' ');
	const sequence = inputText.map(word => {
		var wdIndex = wordIndex[word] + indexFrom;
		if (wdIndex > vocabularySize) {
			wdIndex = 2;
		}
		return wdIndex;
	});
	const paddedSequence = padSequences([sequence]);
	const input = tf.tensor2d(paddedSequence, [1, maxLen]);
	const predictOut = model.predict(input);
	const score = predictOut.dataSync()[0];
	predictOut.dispose();
	return score;
}
