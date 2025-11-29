import { WorkerHandlers } from './handlers.js';
import { htmlBold } from './helpers.js';
import { createTemplateViaRailway } from './railway-integration.js';

export default {
    
    async fetch(request, env, ctx) {
        if (request.method !== 'POST') {
            return new Response('LK NEWS Template Bot - Create professional news templates with your images and headlines!', { status: 200 });
        }
        
        const handlers = new WorkerHandlers(env);

        try {
            const update = await request.json();
            console.log('[Bot] Received update:', JSON.stringify(update).substring(0, 300));
            
            const message = update.message;
            const callbackQuery = update.callback_query;
            
            if (!message && !callbackQuery) {
                 console.log('[Bot] No message or callback query found');
                 return new Response('OK', { status: 200 });
            }
            
            if (message) {
                console.log('[Bot] Processing message from user:', message.from?.id);
            }
            if (callbackQuery) {
                console.log('[Bot] Processing callback query:', callbackQuery.data);
            }
            
            ctx.waitUntil(new Promise(resolve => setTimeout(resolve, 0)));

            if (message) { 
                const chatId = message.chat.id;
                const messageId = message.message_id;
                const text = message.text ? message.text.trim() : null;
                const photo = message.photo;
                const isOwner = env.OWNER_ID && chatId.toString() === env.OWNER_ID.toString();
                
                const userName = message.from.first_name || "User"; 

                ctx.waitUntil(handlers.saveUserId(chatId));

                if (photo) {
                    const photoId = photo[photo.length - 1].file_id;
                    ctx.waitUntil((async () => {
                        try {
                            const photoBuffer = await handlers.getFileBuffer(photoId);
                            if (!photoBuffer) {
                                await handlers.sendMessage(chatId, htmlBold('❌ Error downloading image.'), messageId);
                                return;
                            }
                            
                            await handlers.sendMessage(chatId, htmlBold('📝 Image received!') + '\n\nPlease reply with your headline text:', messageId);
                            const tempKey = `template_image:${chatId}:${Date.now()}`;
                            await env.USER_DATABASE?.put(tempKey, photoBuffer.toString('base64'), { expirationTtl: 3600 });
                            await env.USER_DATABASE?.put(`template_await:${chatId}`, tempKey, { expirationTtl: 3600 });
                        } catch (e) {
                            await handlers.sendMessage(chatId, htmlBold('❌ Error processing image.'), messageId);
                        }
                    })());
                    return new Response('OK', { status: 200 });
                }

                if (text && (await env.USER_DATABASE?.get(`template_await:${chatId}`))) {
                    ctx.waitUntil((async () => {
                        try {
                            const tempKey = await env.USER_DATABASE?.get(`template_await:${chatId}`);
                            const imageBase64 = await env.USER_DATABASE?.get(tempKey);
                            
                            if (!imageBase64) {
                                await handlers.sendMessage(chatId, htmlBold('❌ Image cache expired. Please send the image again.'), messageId);
                                return;
                            }
                            
                            await handlers.sendAction(chatId, 'upload_photo');
                            const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
                            
                            // Call Railway API to create template
                            const railwayApiUrl = env.RAILWAY_API_URL || 'https://web-production-60f63.up.railway.app/api/template';
                            const resultBuffer = await createTemplateViaRailway(imageBase64, text, today, railwayApiUrl);
                            
                            await handlers.sendPhoto(chatId, resultBuffer, htmlBold('✅ Your news template is ready!'), messageId);
                            
                            await env.USER_DATABASE?.delete(tempKey);
                            await env.USER_DATABASE?.delete(`template_await:${chatId}`);
                        } catch (e) {
                            console.log('[Bot] Error creating template:', e.message);
                            await handlers.sendMessage(chatId, htmlBold('❌ Error creating template: ') + e.message, messageId);
                            await env.USER_DATABASE?.delete(`template_await:${chatId}`);
                        }
                    })());
                    return new Response('OK', { status: 200 });
                }

                if (isOwner && message.reply_to_message) {
                    const repliedMessage = message.reply_to_message;
                    
                    if (repliedMessage.text && repliedMessage.text.includes("Please reply with the message you want to broadcast:")) {
                        
                        const messageToBroadcastId = messageId; 
                        const originalChatId = chatId;
                        const promptMessageId = repliedMessage.message_id; 

                        await handlers.editMessage(chatId, promptMessageId, htmlBold("📣 Broadcast started. Please wait."));
                        
                        ctx.waitUntil((async () => {
                            try {
                                const results = await handlers.broadcastMessage(originalChatId, messageToBroadcastId);
                                
                                const resultMessage = htmlBold('Broadcast Complete ✅') + `\n\n`
                                                    + htmlBold(`🚀 Successful: `) + results.successfulSends + '\n'
                                                    + htmlBold(`❗️ Failed/Blocked: `) + results.failedSends;
                                
                                await handlers.sendMessage(chatId, resultMessage, messageToBroadcastId); 

                            } catch (e) {
                                await handlers.sendMessage(chatId, htmlBold("❌ Broadcast Process Failed.") + `\n\nError: ${e.message}`, messageToBroadcastId);
                            }
                        })()); 

                        return new Response('OK', { status: 200 });
                    }
                }
                
                if (isOwner && text && text.toLowerCase().startsWith('/brod') && message.reply_to_message) {
                    const messageToBroadcastId = message.reply_to_message.message_id; 
                    const originalChatId = chatId;
                    
                    await handlers.sendMessage(chatId, htmlBold("📣 Quick Broadcast started..."), messageId);

                    ctx.waitUntil((async () => {
                        try {
                            const results = await handlers.broadcastMessage(originalChatId, messageToBroadcastId);
                            
                            const resultMessage = htmlBold('Quick Broadcast Complete ✅') + `\n\n`
                                                + htmlBold(`🚀 Successful: `) + results.successfulSends + '\n'
                                                + htmlBold(`❗️ Failed/Blocked: `) + results.failedSends;
                            
                            await handlers.sendMessage(chatId, resultMessage, messageToBroadcastId); 

                        } catch (e) {
                            await handlers.sendMessage(chatId, htmlBold("❌ Quick Broadcast failed.") + `\n\nError: ${e.message}`, messageId);
                        }
                    })());

                    return new Response('OK', { status: 200 });
                }
                
                if (text && text.toLowerCase().startsWith('/start')) {
                    
                    if (isOwner) {
                        const ownerText = htmlBold("👑 Welcome Back, Admin!") + "\n\nThis is your Admin Control Panel.";
                        const adminKeyboard = [
                            [{ text: '📊 Users Count', callback_data: 'admin_users_count' }],
                            [{ text: '📣 Broadcast', callback_data: 'admin_broadcast' }],
                            [{ text: 'LK NEWS Download Bot', callback_data: 'ignore_branding' }] 
                        ];
                        await handlers.sendMessage(chatId, ownerText, messageId, adminKeyboard);
                    } else {
                        const userText = `👋 <b>Hello ${userName}!</b>

📰 Welcome to <b>LK NEWS Template Bot</b> - News Template Creator!

📌 <b>How to Create News Template:</b>
1️⃣ Send me an <b>image</b>
2️⃣ Reply with your <b>headline text</b>
3️⃣ Get a professional <b>news template</b> with date!

📌 <b>Features:</b>
✅ Image fills entire template (no stretching)
✅ Headline auto-resizes to fit
✅ Date automatically added
✅ Professional news graphics

◇───────────────◇

🚀 <b>LK NEWS Template Bot</b>
🔥 <b>Powered by Railway + Replit</b>

◇───────────────◇`;
                        
                        await handlers.sendMessage(chatId, userText, messageId);
                    }
                    return new Response('OK', { status: 200 });
                }

                if (text) {
                    await handlers.sendMessage(chatId, htmlBold('ℹ️ News Template Mode Active') + '\n\nTo create a template:\n1️⃣ Send an image\n2️⃣ Reply with your headline\n\n' + htmlBold('That\'s it!'), messageId);
                } 
            }
            
            if (callbackQuery) {
                 const chatId = callbackQuery.message.chat.id;
                 const data = callbackQuery.data;
                 const messageId = callbackQuery.message.message_id;
                 
                 const allButtons = callbackQuery.message.reply_markup.inline_keyboard.flat();
                 const button = allButtons.find(b => b.callback_data === data);
                 const buttonText = button ? button.text : "Action Complete";

                 if (data === 'ignore_branding') {
                     await handlers.answerCallbackQuery(callbackQuery.id, buttonText);
                     return new Response('OK', { status: 200 });
                 }
                 
                 if (env.OWNER_ID && chatId.toString() !== env.OWNER_ID.toString()) {
                      await handlers.answerCallbackQuery(callbackQuery.id, "❌ You cannot use this command.");
                      return new Response('OK', { status: 200 });
                 }

                 switch (data) {
                     case 'admin_users_count':
                          await handlers.answerCallbackQuery(callbackQuery.id, buttonText);
                          const usersCount = await handlers.getAllUsersCount();
                          const countMessage = htmlBold(`📊 Current Users in the Bot: ${usersCount}`);
                          await handlers.editMessage(chatId, messageId, countMessage);
                          break;
                     
                     case 'admin_broadcast':
                          await handlers.answerCallbackQuery(callbackQuery.id, buttonText);
                          const broadcastPrompt = htmlBold("📣 Broadcast Message") + "\n\n" + htmlBold("Please reply with the message you want to broadcast (Text, Photo, or Video).");
                          await handlers.sendMessage(chatId, broadcastPrompt, messageId); 
                          break;
                 }

                 return new Response('OK', { status: 200 });
            }


            return new Response('OK', { status: 200 });

        } catch (e) {
            console.log(`[Bot] Unhandled error: ${e.message}`);
            return new Response('OK', { status: 200 }); 
        }
    }
};
