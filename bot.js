const { Client, GatewayIntentBits, EmbedBuilder, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { initTransfer, sendTransferPanel, createTransferTicket } = require('./transfer');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = '1504900199548457153';
const ROLE_ID = '1511482844365590729';
const LOG_CHANNEL_ID = '1511482808034525367';
const TICKET_CATEGORY_ID = '1514314281821147207';
const TICKET_PANEL_CHANNEL_ID = '1511486592517275708';
const STAFF_ROLE_ID = '1511483588078469120';
const TICKET_STAFF_ROLE_1 = '1505537968276901938';
const TICKET_STAFF_ROLE_2 = '1511483588078469120';
const TICKET_STAFF_ROLE_3 = null;
const TICKET_STAFF_ROLE_4 = null;
const COMMANDER_ROLE_ID = '1505537968276901938';
const COMMANDER_ROLE_2 = '1511483588078469120';
const COMMANDER_ROLE_3 = null;
const COMMANDER_ROLE_4 = null;
const TARGET_CLAN_TAG = 'TMS';

const tagCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
    ]
});

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot hazır: ${client.user.tag}`);
    console.log(`🎯 Sunucu: ${GUILD_ID}`);
    console.log(`🏷️ Aranan tag: ${TARGET_CLAN_TAG}`);
    
    // Transfer modülünü initialize et
    initTransfer(client, {
        GUILD_ID,
        TICKET_CATEGORY_ID,
        TICKET_PANEL_CHANNEL_ID,
        STAFF_ROLE_ID,
        TICKET_STAFF_ROLE_1,
        TICKET_STAFF_ROLE_2,
        TICKET_STAFF_ROLE_3,
        TICKET_STAFF_ROLE_4,
        COMMANDER_ROLE_ID,
        COMMANDER_ROLE_2,
        COMMANDER_ROLE_3,
        COMMANDER_ROLE_4,
    });
    
    await registerSlashCommands();
    await scanAllMembers();
});

async function registerSlashCommands() {
    try {
        const commands = [
            new SlashCommandBuilder()
                .setName('ticket')
                .setDescription('Ticket panelini gönder')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('transfer')
                .setDescription('Transfer panelini gönder')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('otorol')
                .setDescription('Sunucuya girenlere otomatik verilecek rolü ayarla')
                .addRoleOption(option =>
                    option.setName('rol')
                        .setDescription('Otomatik verilecek rol')
                        .setRequired(true))
                .toJSON(),
        ];

        const rest = new REST({ version: '10' }).setToken(TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );
        console.log('✅ Slash komutları kaydedildi');
    } catch (err) {
        console.error('❌ Slash komut hatası:', err.message);
    }
}

async function getClanTag(userId) {
    try {
        const cached = tagCache.get(userId);
        if (cached && Date.now() - cached.time < CACHE_TTL) {
            return cached.tag;
        }
        const rawUser = await client.rest.get(`/users/${userId}`);
        const tag = rawUser?.clan?.tag || null;
        tagCache.set(userId, { tag, time: Date.now() });
        return tag;
    } catch (err) {
        console.error(`Tag hatası (${userId}): ${err.message}`);
        return null;
    }
}

async function memberHasTag(member) {
    try {
        const clanTag = await getClanTag(member.user.id);
        return clanTag === TARGET_CLAN_TAG;
    } catch {
        return false;
    }
}

async function giveRole(member) {
    try {
        if (member.roles.cache.has(ROLE_ID)) return;
        await member.roles.add(ROLE_ID);
        console.log(`✅ Rol verildi: ${member.user.tag}`);
        await sendLog(member, 'add');
    } catch (err) {
        console.error(`❌ Rol verme hatası (${member.user.tag}):`, err.message);
    }
}

async function removeRole(member) {
    try {
        if (!member.roles.cache.has(ROLE_ID)) return;
        await member.roles.remove(ROLE_ID);
        console.log(`🗑️ Rol alındı: ${member.user.tag}`);
        await sendLog(member, 'remove');
    } catch (err) {
        console.error(`❌ Rol alma hatası (${member.user.tag}):`, err.message);
    }
}

async function sendLog(member, action) {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        const logChannel = guild?.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;

        const isAdd = action === 'add';
        const embed = new EmbedBuilder()
            .setColor(isAdd ? 0x00FF7F : 0xFF4444)
            .setTitle(isAdd ? '✅ TMS Tag Rolü Verildi' : '❌ TMS Tag Rolü Alındı')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Kullanıcı', value: `${member} (${member.user.tag})`, inline: true },
                { name: '🆔 ID', value: member.user.id, inline: true },
                { name: '🏷️ Tag', value: TARGET_CLAN_TAG, inline: true },
                { name: '⚙️ İşlem', value: isAdd ? 'Rol Verildi' : 'Rol Alındı', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: 'TMS Tag Sistemi' });

        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('❌ Log hatası:', err.message);
    }
}

async function scanAllMembers() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();

        console.log(`🔍 ${members.size} üye taranıyor...`);

        let given = 0;
        let removed = 0;

        const memberArray = Array.from(members.values());
        const batchSize = 300;

        for (let i = 0; i < memberArray.length; i += batchSize) {
            const batch = memberArray.slice(i, i + batchSize);
            await Promise.all(batch.map(async (member) => {
                try {
                    const clanTag = await getClanTag(member.user.id);
                    const hasTag = clanTag === TARGET_CLAN_TAG;
                    const hasRole = member.roles.cache.has(ROLE_ID);

                    if (hasTag && !hasRole) {
                        await giveRole(member);
                        given++;
                    } else if (!hasTag && hasRole) {
                        await removeRole(member);
                        removed++;
                    }
                } catch (err) {
                    console.error(`Üye hatası (${member.user.id}): ${err.message}`);
                }
            }));
        }

        console.log(`✅ Tarama tamamlandı. Verilen: ${given}, Alınan: ${removed}`);
    } catch (err) {
        console.error('❌ Tarama hatası:', err.message);
    }
}

async function sendTicketPanel() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const ticketChannel = guild?.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
        if (!ticketChannel) {
            console.error('❌ Ticket kanali bulunamadi');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF7F)
            .setTitle('🎫 TMS Destek Sistemi')
            .setDescription('Sorununuz varsa aşağıdaki butona basarak ticket oluşturun.')
            .addFields(
                { name: '📋 Kategori Seçin', value: '**Destek** - Teknik destek için\n**Şikayet** - Şikayet bildirmek için\n**Diğer** - Diğer konular için', inline: false },
            )
            .setFooter({ text: 'TMS Ticket Sistemi' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_destek')
                    .setLabel('📞 Destek')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_sikayet')
                    .setLabel('⚠️ Şikayet')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_diger')
                    .setLabel('❓ Diğer')
                    .setStyle(ButtonStyle.Secondary),
            );

        const messages = await ticketChannel.messages.fetch({ limit: 10 });
        for (const msg of messages) {
            if (msg[1].author.id === client.user.id) {
                await msg[1].delete().catch(() => {});
            }
        }

        await ticketChannel.send({ embeds: [embed], components: [row] });
        console.log('✅ Ticket paneli gönderildi');
    } catch (err) {
        console.error('❌ Ticket paneli hatası:', err.message);
    }
}

async function createTicket(interaction, type) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        const user = interaction.user;
        
        let category = guild.channels.cache.get(TICKET_CATEGORY_ID);
        if (!category) {
            category = await guild.channels.create({
                name: 'TMS - Tickets',
                type: ChannelType.GuildCategory,
            });
        }

        const ticketChannel = await guild.channels.create({
            name: `ticket-${type}-${user.username}`,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                },
                {
                    id: user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: STAFF_ROLE_ID,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
                {
                    id: TICKET_STAFF_ROLE_1,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
                {
                    id: TICKET_STAFF_ROLE_2,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
            ],
        });

        const typeEmoji = {
            destek: '📞',
            sikayet: '⚠️',
            diger: '❓',
        };

        const typeLabel = {
            destek: 'Destek',
            sikayet: 'Şikayet',
            diger: 'Diğer',
        };

        const embed = new EmbedBuilder()
            .setColor(0x00FF7F)
            .setTitle(`${typeEmoji[type]} TMS ${typeLabel[type]} Ticket'ı`)
            .setDescription(`Hoşgeldiniz ${user}!\n\nSorunuzu açıklayın, takımımız yardımcı olmaya hazır.`)
            .setFooter({ text: `Ticket ID: ${ticketChannel.id}` });

        const closeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_${ticketChannel.id}`)
                    .setLabel('🔒 Ticket Kapat')
                    .setStyle(ButtonStyle.Danger),
            );

        await ticketChannel.send({ content: `<@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [closeRow] });
        
        await interaction.editReply({
            content: `✅ Ticket oluşturuldu: ${ticketChannel}`,
            ephemeral: true,
        });

        console.log(`🎫 Ticket oluşturuldu: ${user.tag} - ${ticketChannel.name}`);
    } catch (err) {
        console.error('❌ Ticket oluşturma hatası:', err.message);
        await interaction.editReply({
            content: `❌ Hata: ${err.message}`,
            ephemeral: true,
        }).catch(() => {});
    }
}

async function closeTicket(interaction, ticketId) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.guild.channels.cache.get(ticketId);
        if (!channel) {
            await interaction.editReply({
                content: '❌ Kanal bulunamadı',
                ephemeral: true,
            });
            return;
        }

        await channel.permissionOverwrites.create(
            interaction.user.id,
            { ViewChannel: false }
        );

        const embed = new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('🔒 Ticket Kapatıldı')
            .setDescription('Bu ticket kapatılmıştır. Yetkili ekip sorununuzu çözdüğünü düşünüyor.')
            .setFooter({ text: 'TMS Ticket Sistemi' });

        const deleteRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_${ticketId}`)
                    .setLabel('🗑️ Kanalı Sil')
                    .setStyle(ButtonStyle.Danger),
            );

        await channel.send({ embeds: [embed], components: [deleteRow] });

        await interaction.editReply({
            content: '✅ Ticket kapatıldı!',
            ephemeral: true,
        });

        console.log(`🔒 Ticket kapatıldı: ${channel.name}`);
    } catch (err) {
        console.error('❌ Ticket kapatma hatası:', err.message);
        await interaction.editReply({
            content: `❌ Hata: ${err.message}`,
            ephemeral: true,
        }).catch(() => {});
    }
}

async function reopenTicket(interaction, ticketId) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.guild.channels.cache.get(ticketId);
        if (!channel) {
            await interaction.editReply({
                content: '❌ Kanal bulunamadı',
                ephemeral: true,
            });
            return;
        }

        await channel.permissionOverwrites.create(
            interaction.user.id,
            { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FF7F)
            .setTitle('🔓 Ticket Geri Açıldı')
            .setDescription('Ticket geri açılmıştır. Sorununuz devam ederse yazabilirsiniz.')
            .setFooter({ text: 'TMS Ticket Sistemi' });

        await channel.send({ embeds: [embed] });

        await interaction.editReply({
            content: '✅ Ticket geri açıldı!',
            ephemeral: true,
        });

        console.log(`🔓 Ticket geri açıldı: ${channel.name}`);
    } catch (err) {
        console.error('❌ Ticket geri açma hatası:', err.message);
        await interaction.editReply({
            content: `❌ Hata: ${err.message}`,
            ephemeral: true,
        }).catch(() => {});
    }
}

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (newMember.guild.id !== GUILD_ID) return;
    tagCache.delete(newMember.user.id);

    const hadTag = await memberHasTag(oldMember);
    const hasTag = await memberHasTag(newMember);

    if (!hadTag && hasTag) {
        console.log(`🎯 Tag eklendi! ${newMember.user.username}`);
        await giveRole(newMember);
    } else if (hadTag && !hasTag) {
        console.log(`❌ Tag kaldırıldı! ${newMember.user.username}`);
        await removeRole(newMember);
    }
});

const AUTO_ROLE_ID = '1518375640879857694';
let autoRoleId = AUTO_ROLE_ID;

client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild.id !== GUILD_ID) return;

    // Sunucuya giren herkese otomatik rol ver
    try {
        await member.roles.add(autoRoleId);
        console.log(`✅ Otomatik rol verildi: ${member.user.tag}`);
    } catch (err) {
        console.error(`❌ Otomatik rol hatası (${member.user.tag}):`, err.message);
    }

    if (await memberHasTag(member)) {
        await giveRole(member);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
        if (interaction.commandName === 'ticket') {
            await interaction.deferReply({ ephemeral: true });
            await sendTicketPanel();
            await interaction.editReply({
                content: '✅ Ticket paneli gönderildi!',
                ephemeral: true,
            });
        } else if (interaction.commandName === 'transfer') {
            await interaction.deferReply({ ephemeral: true });
            await sendTransferPanel(interaction.channel);
            await interaction.editReply({
                content: '✅ Transfer paneli gönderildi!',
                ephemeral: true,
            });
        } else if (interaction.commandName === 'otorol') {
            const rol = interaction.options.getRole('rol');
            autoRoleId = rol.id;
            await interaction.reply({
                content: `✅ Otomatik rol ayarlandı: <@&${rol.id}>`,
                ephemeral: true,
            });
        }
        return;
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('ticket_')) {
            const type = interaction.customId.replace('ticket_', '');
            await createTicket(interaction, type);
        } else if (interaction.customId.startsWith('transfer_')) {
            const type = interaction.customId.replace('transfer_', '');
            await createTransferTicket(interaction, type);
        } else if (interaction.customId.startsWith('close_')) {
            const ticketId = interaction.customId.replace('close_', '');
            await closeTicket(interaction, ticketId);
        } else if (interaction.customId.startsWith('delete_')) {
            const ticketId = interaction.customId.replace('delete_', '');
            const channel = interaction.guild.channels.cache.get(ticketId);
            if (channel) {
                await interaction.reply({ content: '🗑️ Kanal siliniyor...', ephemeral: true });

                // Ticket mesajlarını kaydet
                try {
                    const logChannel = interaction.guild.channels.cache.get('1505539177733820427');
                    if (logChannel) {
                        const messages = await channel.messages.fetch({ limit: 100 });
                        const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                        // Başlık embed
                        const logEmbed = new EmbedBuilder()
                            .setColor(0xFF4444)
                            .setTitle(`📋 Ticket Kaydı: #${channel.name}`)
                            .addFields(
                                { name: '📁 Kanal', value: `#${channel.name}`, inline: true },
                                { name: '🗑️ Silen', value: `${interaction.user}`, inline: true },
                                { name: '📅 Tarih', value: new Date().toLocaleString('tr-TR'), inline: true },
                                { name: '💬 Mesaj Sayısı', value: `${sorted.filter(m => !m.author.bot).length}`, inline: true },
                            )
                            .setTimestamp()
                            .setFooter({ text: 'TMS Ticket Log' });

                        await logChannel.send({ embeds: [logEmbed] });

                        // Her mesajı ayrı embed olarak gönder
                        for (const msg of sorted) {
                            if (msg.author.bot) continue;

                            const msgEmbed = new EmbedBuilder()
                                .setColor(0x7B68EE)
                                .setAuthor({
                                    name: msg.author.tag,
                                    iconURL: msg.author.displayAvatarURL({ dynamic: true }),
                                })
                                .setTimestamp(msg.createdAt);

                            if (msg.content) {
                                msgEmbed.setDescription(msg.content);
                            }

                            // Fotoğraf ve dosyaları ekle
                            const imageAttachments = msg.attachments.filter(a =>
                                a.contentType && a.contentType.startsWith('image/')
                            );
                            const otherAttachments = msg.attachments.filter(a =>
                                !a.contentType || !a.contentType.startsWith('image/')
                            );

                            if (imageAttachments.size > 0) {
                                msgEmbed.setImage(imageAttachments.first().url);
                            }

                            if (otherAttachments.size > 0) {
                                msgEmbed.addFields({
                                    name: '📎 Dosyalar',
                                    value: otherAttachments.map(a => `[${a.name}](${a.url})`).join('\n'),
                                });
                            }

                            await logChannel.send({ embeds: [msgEmbed] });

                            // Birden fazla fotoğraf varsa gerisini de gönder
                            if (imageAttachments.size > 1) {
                                const rest = [...imageAttachments.values()].slice(1);
                                for (const att of rest) {
                                    const imgEmbed = new EmbedBuilder()
                                        .setColor(0x7B68EE)
                                        .setImage(att.url)
                                        .setAuthor({
                                            name: msg.author.tag,
                                            iconURL: msg.author.displayAvatarURL({ dynamic: true }),
                                        });
                                    await logChannel.send({ embeds: [imgEmbed] });
                                }
                            }
                        }

                        await logChannel.send({ content: '─────────────────────────' });
                    }
                } catch (err) {
                    console.error('❌ Ticket log hatası:', err.message);
                }

                await channel.delete();
            }
        } else if (interaction.customId.startsWith('reopen_')) {
            const ticketId = interaction.customId.replace('reopen_', '');
            await reopenTicket(interaction, ticketId);
        }
    }
});

client.login(TOKEN);
