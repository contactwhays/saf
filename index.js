const server= require('./server');
const { Client, GatewayIntentBits, Events, REST, Routes, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const ROBLOX_USER_URL_BY_ID = 'https://users.roblox.com/v1/users/';

let robloxName; // Global variable to store Roblox display name

// Define the slash commands
const commands = [
    {
        name: 'verify',
        description: 'Verifiziert einen Roblox-Nutzer anhand der ID',
        options: [
            {
                type: 3, // STRING
                name: 'user_id',
                description: 'Die Roblox-Nutzer-ID',
                required: true,
            },
        ],
    },
    {
        name: 'verify-help',
        description: 'Erklärt, wie man seine Roblox-ID findet',
    },
];

// Register commands with Discord
const registerCommands = async () => {
    try {
        console.log('Starte das Aktualisieren der Anwendung (/) Befehle.');

        const rest = new REST({ version: '10' }).setToken(token);
        await rest.put(Routes.applicationCommands(clientId), { body: commands });

        console.log('Anwendung (/) Befehle erfolgreich aktualisiert.');
    } catch (error) {
        console.error('Fehler beim Registrieren der Befehle:', error);
    }
};

// Create the client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.once(Events.ClientReady, () => {
    console.log('Bot ist online!');
    registerCommands(); // Register commands when the bot is ready
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    if (interaction.isCommand()) {
        const { commandName, options, member } = interaction;

        if (commandName === 'verify') {
            // Check if the user already has the "Verifiziert" role
            const verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'verifiziert');
            if (member.roles.cache.has(verifiedRole?.id)) {
                return interaction.reply({
                    content: 'Du bist bereits verifiziert und kannst den Verifizierungsprozess nicht erneut durchlaufen.',
                    ephemeral: true,
                });
            }

            const userId = options.getString('user_id');

            if (!userId) {
                return interaction.reply({
                    content: 'Bitte gib eine Roblox-Nutzer-ID an.',
                    ephemeral: true
                });
            }

            try {
                const response = await axios.get(`${ROBLOX_USER_URL_BY_ID}${userId}`);
                const user = response.data;

                if (user && user.id) {
                    robloxName = user.displayName; // Set global variable

                    // Buttons for interaction
                    const verifyButton = new ButtonBuilder()
                        .setCustomId('verify_end')
                        .setLabel('Verifizierung Beenden')
                        .setStyle(ButtonStyle.Primary);

                    const cancelButton = new ButtonBuilder()
                        .setCustomId('verify_cancel')
                        .setLabel('Abbrechen')
                        .setStyle(ButtonStyle.Danger);

                    const row = new ActionRowBuilder().addComponents(verifyButton, cancelButton);

                    await interaction.reply({
                        content: `Nutzer-ID "${userId}" entspricht dem Anzeigenamen "${robloxName}". Bitte wähle aus, was du tun möchtest.`,
                        components: [row],
                        ephemeral: true
                    });

                } else {
                    await interaction.reply({
                        content: `Nutzer-ID "${userId}" existiert nicht.`,
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Fehler beim Abrufen der Roblox-Nutzerinformationen:', error.message);
                await interaction.reply({
                    content: 'Es gab einen Fehler beim Verifizieren der Roblox-Nutzer-ID.',
                    ephemeral: true
                });
            }
        } else if (commandName === 'verify-help') {
            await interaction.reply({
                content: 'Um deine Roblox-ID zu finden, folge diesen Schritten:\n\n' +
                         '1. Melde dich bei der Roblox-Website an.\n' +
                         '2. Gehe zu deinem Profil.\n' +
                         '3. Die URL deiner Profilseite enthält deine ID als eine lange Zahl. Zum Beispiel: `https://roblox.com/users/1234567890/profile`, wobei `1234567890` deine ID ist.',
                ephemeral: true
            });
        }
    } else if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === 'verify_end') {
            const guild = client.guilds.cache.get(interaction.guildId);
            const member = guild.members.cache.get(interaction.user.id);

            if (member) {
                try {
                    if (!robloxName) {
                        await interaction.reply({
                            content: 'Fehler: Anzeigename konnte nicht ermittelt werden.',
                            ephemeral: true
                        });
                        return;
                    }

                    // Create a new role with the Roblox display name
                    const existingRole = guild.roles.cache.find(role => role.name === robloxName);

                    if (!existingRole) {
                        await guild.roles.create({
                            name: robloxName,
                            color: '#00FF00', // Set role color as a Hex value (green in this case)
                            reason: 'Role created for verified Roblox user',
                        });
                    }

                    // Add the "Verified" role and the new role to the member
                    const verifiedRole = guild.roles.cache.find(role => role.name === 'Verifiziert');
                    if (verifiedRole) {
                        await member.roles.add(verifiedRole);
                    }

                    const newRole = guild.roles.cache.find(role => role.name === robloxName);
                    if (newRole) {
                        await member.roles.add(newRole);
                    }

                    await interaction.reply({
                        content: `Die Verifizierung für den Roblox-Nutzer wurde abgeschlossen. Du hast jetzt die Rollen "Verifiziert" und "${robloxName}".`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Fehler beim Zuweisen der Rollen:', error.message);
                    await interaction.reply({
                        content: 'Es gab einen Fehler beim Hinzufügen der Rollen.',
                        ephemeral: true
                    });
                }
            } else {
                await interaction.reply({
                    content: 'Fehler: Mitglied nicht gefunden.',
                    ephemeral: true
                });
            }
        } else if (customId === 'verify_cancel') {
            await interaction.reply({
                content: 'Die Verifizierung wurde abgebrochen.',
                ephemeral: true
            });
        }
    }
});

client.login(token);