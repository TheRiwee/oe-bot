const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
dotenv.config();

const TOKEN = process.env.TOKEN;
const COIN_MANAGER_ROLE_ID = '1356991345033740369'; // Yönetici rolü ID'si

const db = new sqlite3.Database('./coins.db', (err) => {
    if (err) console.error('❌ Veritabanına bağlanırken hata oluştu:', err.message);
    else console.log('✅ Veritabanına başarıyla bağlanıldı.');
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

client.once('ready', () => {
    console.log(`✅ Bot giriş yaptı: ${client.user.tag}`);
    client.user.setActivity('Reelly ?');
});

// Coin Miktarını Al
function getUserCoins(userId, callback) {
    db.get(`SELECT coin_amount FROM coins WHERE user_id = ?`, [userId], (err, row) => {
        if (err) {
            console.error('❌ Veritabanından coin okunamadı:', err.message);
            callback(0);
        } else {
            callback(row ? row.coin_amount : 100);
        }
    });
}

// Coin Güncelle
function modifyUserCoins(userId, amount, callback) {
    getUserCoins(userId, (coins) => {
        const newAmount = coins + amount;
        if (newAmount < 0) {
            callback(false, coins);
        } else {
            db.run(
                `INSERT INTO coins (user_id, coin_amount) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET coin_amount = ?`,
                [userId, newAmount, newAmount],
                (err) => {
                    if (err) {
                        console.error('❌ Coin güncellenirken hata oluştu:', err.message);
                        callback(false, coins);
                    } else {
                        callback(true, newAmount);
                    }
                }
            );
        }
    });
}

// Sesli Kanal Komutları
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.toLowerCase();
    const member = message.member;
    const guild = message.guild;

    // r!coinim ve r!coin komutu
    if (content === 'r!coin' || content === 'r!coinim') {
        getUserCoins(userId, (coins) => {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`${message.author.username} - Profil Bilgileri`)
                .setThumbnail(message.author.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı Adı', value: message.author.username, inline: true },
                    { name: '🪙 Coin Miktarı', value: `${coins} 🪙`, inline: true }
                )
                .setFooter({ text: 'r!coinim komutu ile bakiyenizi öğrenebilirsiniz.' });
            return message.reply({ embeds: [embed] });
        });
    }

    // r!yardım komutu
    if (content === 'r!yardım') {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📜 Kullanılabilir Komutlar')
            .setDescription('Aşağıdaki komutları kullanarak botla etkileşime geçebilirsiniz:')
            .addFields(
                {
                    name: '📌 Komut Listesi',
                    value: '```' +
                        'Komut           | Açıklama\n' +
                        '-----------------|------------------------------------------------------------\n' +
                        'r!coinim         | Coin miktarınızı görüntüleyin.\n' +
                        'r!tasarımlar     | Tasarım kanallarını görüntüleyin.\n' +
                        'r!yardım         | Yardım menüsünü görüntüleyin.\n' +
                        'r!istatistikler  | Kullanıcı istatistiklerinizi görüntüleyin.\n' +
                        'r!başarılar      | Başarılarınızı görüntüleyin.\n' +
                        'r!sıralama       | Lider tablosundaki sıralamanızı görün.\n' +
                        'r!seslikanala katıl | Sesli kanala katılın.\n' +
                        'r!seslikanaldan ayrıl | Sesli kanaldan ayrılın.\n' +
                        '```'
                }
            )
            .setFooter({ text: 'Reelly Coin Sistemi | GPTOnline.ai destekli' });
        return message.reply({ embeds: [embed] });
    }

    // r!tasarımlar komutu
    if (content === 'r!tasarımlar') {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎨 Mevcut Tasarım Kanalları')
            .setDescription(
                '📌 [Tasarım Kanalı 1](https://discord.com/channels/' + guild.id + '/1357001007988736152)\n' +
                '📌 [Tasarım Kanalı 2](https://discord.com/channels/' + guild.id + '/1357001122983968918)'
            )
            .setFooter({ text: 'İlgili tasarım kanalına tıklayarak doğrudan ulaşabilirsiniz.' });
        return message.reply({ embeds: [embed] });
    }

    // r!coin ekle ve r!coin sil komutları
    if (content.startsWith('r!coin ekle') || content.startsWith('r!coin sil')) {
        // Burada, kullanıcının rol ID'sine göre yetki kontrolü yapıyoruz.
        if (!member.roles.cache.has(COIN_MANAGER_ROLE_ID)) {
            return message.reply('❌ Bu komutu kullanma yetkiniz yok!');
        }
        
        const args = message.content.split(' ');
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[args.length - 1]);

        if (!targetUser || isNaN(amount) || amount <= 0) {
            return message.reply('⚠️ **Geçerli bir kullanıcı ve miktar belirtmelisiniz.**\nÖrnek: `r!coin ekle @kullanıcı 100`');
        }

        modifyUserCoins(targetUser.id, content.startsWith('r!coin ekle') ? amount : -amount, (success, newAmount) => {
            if (success) {
                return message.reply(`✅ **${targetUser.username}** adlı kullanıcıya **${amount} coin** ${content.startsWith('r!coin ekle') ? 'eklendi' : 'çıkarıldı'}!\nYeni bakiye: **${newAmount} 🪙**`);
            } else {
                return message.reply(`❌ **${targetUser.username}** adlı kullanıcının yeterli coini yok!\nMevcut bakiye: **${newAmount} 🪙**`);
            }
        });
    }

    // Sesli kanala katılma komutu
    if (content === 'r!seslikanala katıl') {
        if (member.voice.channel) {
            const connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                message.reply('✅ Sesli kanala katıldım!');
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                message.reply('❌ Sesli kanaldan ayrıldım.');
            });
        } else {
            message.reply('⚠️ Lütfen önce bir sesli kanala katılın.');
        }
    }

    // Sesli kanaldan ayrılma komutu
    if (content === 'r!seslikanaldan ayrıl') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('✅ Sesli kanaldan ayrıldım.');
        } else {
            message.reply('⚠️ Benim sesli bir kanalda olduğumdan emin olun.');
        }
    }
});

// Botu başlat
client.login(TOKEN);
