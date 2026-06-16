const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

// Rol ID'leri (main bot.js'den al)
let GUILD_ID, TICKET_CATEGORY_ID, TICKET_PANEL_CHANNEL_ID, STAFF_ROLE_ID;
let TICKET_STAFF_ROLE_1, TICKET_STAFF_ROLE_2, TICKET_STAFF_ROLE_3, TICKET_STAFF_ROLE_4;
let COMMANDER_ROLE_ID, COMMANDER_ROLE_2, COMMANDER_ROLE_3, COMMANDER_ROLE_4;
let client;

// İnitialize et
function initTransfer(botClient, config) {
    client = botClient;
    GUILD_ID = config.GUILD_ID;
    TICKET_CATEGORY_ID = config.TICKET_CATEGORY_ID;
    TICKET_PANEL_CHANNEL_ID = config.TICKET_PANEL_CHANNEL_ID;
    STAFF_ROLE_ID = config.STAFF_ROLE_ID;
    TICKET_STAFF_ROLE_1 = config.TICKET_STAFF_ROLE_1;
    TICKET_STAFF_ROLE_2 = config.TICKET_STAFF_ROLE_2;
    TICKET_STAFF_ROLE_3 = config.TICKET_STAFF_ROLE_3;
    TICKET_STAFF_ROLE_4 = config.TICKET_STAFF_ROLE_4;
    COMMANDER_ROLE_ID = config.COMMANDER_ROLE_ID;
    COMMANDER_ROLE_2 = config.COMMANDER_ROLE_2;
    COMMANDER_ROLE_3 = config.COMMANDER_ROLE_3;
    COMMANDER_ROLE_4 = config.COMMANDER_ROLE_4;
}

async function sendTransferPanel(channel = null) {
    try {
        let targetChannel = channel;
        
        if (!targetChannel) {
            const guild = await client.guilds.fetch(GUILD_ID);
            targetChannel = guild?.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
        }
        
        if (!targetChannel) {
            console.error('❌ Ticket kanali bulunamadi');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x7B68EE)
            .setTitle('💱 Transfer Sistemi')
            .setDescription('Transfer almak istiyorsunuz? Aşağıdaki menüyü kullanarak duruma en uygun kategoriyi seçip bir bilet oluşturabilirsiniz. Transfer ekibimiz en kısa sürede sizinle ilgilenecektir.')
            .addFields(
                { name: '💎 Bireysel Transfer', value: '• Tek kişilik transferler\n• Başkumandan rutbesine kadar sınır.', inline: false },
                { name: '👥 Ekipli/Özet Transfer', value: '• Ekipli, Sunuculu/Family\'li transferler.\n• Başkumandan rutbesine kadar sınır, ancak ekibinizin büyüklüğüne göre bu sınır değişebilir.', inline: false },
            )
            .setFooter({ text: 'TMS Transfer Sistemi' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('transfer_bireysel')
                    .setLabel('💎 Bireysel Transfer')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('transfer_ekipli')
                    .setLabel('👥 Ekipli Transfer')
                    .setStyle(ButtonStyle.Success),
            );

        await targetChannel.send({ embeds: [embed], components: [row] });
        console.log('✅ Transfer paneli gönderildi');
    } catch (err) {
        console.error('❌ Transfer paneli hatası:', err.message);
    }
}

async function createTransferTicket(interaction, type) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        const user = interaction.user;
        
        let category = guild.channels.cache.get(TICKET_CATEGORY_ID);
        if (!category) {
            category = await guild.channels.create({
                name: 'TMS - Transfer',
                type: ChannelType.GuildCategory,
            });
        }

        const ticketChannel = await guild.channels.create({
            name: `transfer-${type}-${user.username}`,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: ['ViewChannel'],
                },
                {
                    id: user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
                {
                    id: TICKET_STAFF_ROLE_1,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
                {
                    id: TICKET_STAFF_ROLE_2,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
                {
                    id: TICKET_STAFF_ROLE_3,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
                {
                    id: TICKET_STAFF_ROLE_4,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
                },
            ],
        });

        const typeEmoji = {
            bireysel: '💎',
            ekipli: '👥',
        };

        const typeLabel = {
            bireysel: 'Bireysel Transfer',
            ekipli: 'Ekipli Transfer',
        };

        const embed = new EmbedBuilder()
            .setColor(0x7B68EE)
            .setTitle(`${typeEmoji[type]} TMS ${typeLabel[type]} Talebi`)
            .setDescription(`Hoşgeldiniz ${user}!\n\nTransfer talebiniz hakkında bilgi verin, transfer ekibimiz yardımcı olmaya hazır.`)
            .setFooter({ text: `Ticket ID: ${ticketChannel.id}` });

        const closeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_${ticketChannel.id}`)
                    .setLabel('🔒 Ticket Kapat')
                    .setStyle(ButtonStyle.Danger),
            );

        await ticketChannel.send({ content: `<@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [closeRow] });
        
        const formEmbed = new EmbedBuilder()
            .setColor(0x7B68EE)
            .setTitle('📋 Transfer Formu')
            .addFields(
                { name: 'İsim:', value: 'Lütfen adınızı yazınız', inline: false },
                { name: 'Oynadığım Kamplar:', value: 'Lütfen kamplarınızı yazınız', inline: false },
                { name: 'Tecrübelerim:', value: 'Lütfen tecrübelerinizi yazınız', inline: false },
                { name: 'SS:', value: 'Lütfen screenshot\'larınızı paylaşınız', inline: false },
                { name: 'Tag:', value: 'Lütfen taglerinizi yazınız', inline: false },
            )
            .setFooter({ text: 'Formu tamamladıktan sonra Yetkili ekip inceleyecektir' });

        await ticketChannel.send({ 
            content: `<@&${COMMANDER_ROLE_ID}> <@&${COMMANDER_ROLE_2}> <@&${COMMANDER_ROLE_3}> <@&${COMMANDER_ROLE_4}>`,
            embeds: [formEmbed] 
        });
        
        await interaction.editReply({
            content: `✅ Transfer talebi oluşturuldu: ${ticketChannel}`,
            ephemeral: true,
        });

        console.log(`💱 Transfer talebi oluşturuldu: ${user.tag} - ${ticketChannel.name}`);
    } catch (err) {
        console.error('❌ Transfer talebi oluşturma hatası:', err.message);
        await interaction.editReply({
            content: `❌ Hata: ${err.message}`,
            ephemeral: true,
        }).catch(() => {});
    }
}

module.exports = {
    initTransfer,
    sendTransferPanel,
    createTransferTicket,
};
