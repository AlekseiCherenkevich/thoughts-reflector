const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';

async function callGroq(messages, model = process.env.GROQ_MODEL || 'llama-3-8b-8192') {
  try {
    const response = await axios.post(GROQ_API_URL, {
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    const err = new Error(`Groq API error: ${error.response?.status || error.message}`);
    err.status = error.response?.status;
    throw err;
  }
}

async function callHuggingFace(messages, model = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2') {
  const formattedMessages = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
  
  try {
    const response = await axios.post(`${HUGGINGFACE_API_URL}/${model}`, {
      inputs: formattedMessages,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const data = response.data;
    return Array.isArray(data) ? data[0].generated_text : data.generated_text;
  } catch (error) {
    const err = new Error(`HuggingFace API error: ${error.response?.status || error.message}`);
    err.status = error.response?.status;
    throw err;
  }
}

async function callLLM(messages, retryCount = 0) {
  try {
    return await callGroq(messages);
  } catch (error) {
    if (error.status === 429 && retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return callLLM(messages, retryCount + 1);
    }
    
    if (error.status === 503 || (retryCount > 0 && retryCount < 3)) {
      try {
        return await callHuggingFace(messages);
      } catch (hfError) {
        if (retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 30000));
          return callLLM(messages, retryCount + 1);
        }
        throw hfError;
      }
    }
    
    throw error;
  }
}

module.exports = {
  callGroq,
  callHuggingFace,
  callLLM
};