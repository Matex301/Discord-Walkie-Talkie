import {Client, CollectorFilter, Message, MessageEmbed, ReactionCollector, Snowflake, Speaking, User, VoiceChannel, VoiceConnection} from 'discord.js'
import * as internal from 'stream'
import * as CJSON from './config.json';

interface Config {
    token: string;
    prefix: string;
}

interface ServerQueue {
    id: Snowflake,
    name: string,
    connection: VoiceConnection,
    speakers: Map<string, internal.Readable>
    recorder: internal.PassThrough,
    options: {
    }
}

const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);
class Silence extends internal.Readable {
  _read() {
    this.push(SILENCE_FRAME);
    this.destroy();
  }
}

class DiscordTS {
    private client: Client;
    private config: Config;
    private servers: Map<Snowflake, ServerQueue>;

    constructor(){
        this.client = new Client();
        this.config = CJSON;
        this.servers = new Map<Snowflake, ServerQueue>();
    }

    public start(): void {

        this.client.on('message', async (message: Message) => {
            if(message.author.bot) return;
            if(message.channel.type != 'text') return;
            if(!message.content.startsWith(this.config.prefix)) return;
            let server: ServerQueue = this.servers.get(message.guild.id);
            if(!server){
                server = {
                    id: message.guild.id,
                    name: message.guild.name,
                    connection: null,
                    speakers: new Map<string, internal.Readable>(),
                    recorder: null,
                    options: {
                    }
                }
                this.servers.set(message.guild.id, server);
            }

            if(message.content.startsWith(`${this.config.prefix}join`)){
                this.join(message, server);
            } else if(message.content.startsWith(`${this.config.prefix}connect`)){
                this.connect(message, server);
            }
        });

        this.client.on('error', error => console.log(error));
        this.client.on('warn', warn => console.log(warn));
        this.client.login(this.config.token);
    }

    private async join(message: Message, server: ServerQueue): Promise<void> {
        const target: VoiceChannel = message.member.voice.channel;

        if(!server.connection){
            server.connection = await target.join();
        }
    }

    private async connect(message: Message, server: ServerQueue): Promise<void> {
        server.connection.play(new Silence(), {type: 'opus'});
        server.connection.on('speaking', (user: User, speaking: Readonly<Speaking>) => {
            if(user.bot)
                return
            if(server.speakers.get(user.id))
                return
            let userStream: internal.Readable = server.connection.receiver.createStream(user, {end: 'manual'});
            server.speakers.set(user.id, userStream);
            userStream.on('data', (chunk) => {
                server.connection.dispatcher.write(chunk);
            })
        });
    }
}

let test: DiscordTS = new DiscordTS();
test.start();

/*
private async connect(message: Message, server: ServerQueue): Promise<void> {
        server.connection.on('speaking', (user: User, speaking: Readonly<Speaking>) => {
            if(user.bot)
                return
            if(server.speakers.get(user.id))
                return
            let userStream: internal.Readable = server.connection.receiver.createStream(user, {end: 'manual'});
            server.speakers.set(user.id, userStream);
            server.connection.play(userStream, {type: 'opus'});
        });
    }
*/