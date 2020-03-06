import { MentionResource } from '@atlaskit/mention/resource';
import _ from 'underscore';
const MAX_RESULT = 10;
class JiraMentionResource extends MentionResource {
    constructor(props) {
        super(props);
        this.mentionTypeaheadHighlightEnabled = true;
        this.mentionTypeaheadCreateTeamPath = true;
    }
    verifyMentionConfig() { }
    recordMentionSelection() { }
    remoteInitialState = () => {
        return this.jira.searchUsers('', MAX_RESULT)
            .then((result) => {
                const mentions = this.transformServiceResponse(result, '');
                // this.notify(searchTime, mentions, '');
                return mentions;
            });
    };
    search = (query) => {
        return {
            mentions: this.remoteSearch(query)
        };
    };
    remoteSearch = (query) => {
        return this.jira.searchUsers(query, MAX_RESULT)
            .then((result) => {
                const mentions = this.transformServiceResponse(result, query);
                // this.notify(searchTime, mentions, query);
                return mentions;
            });
    };
    transformServiceResponse = (result, query) => {
        var mentions = result.map(function (mention) {
            var lozenge;
            // if (types_1.isAppMention(mention)) {
            //     lozenge = mention.userType;
            // }
            // else if (types_1.isTeamMention(mention)) {
            //     lozenge = mention.userType;
            // }
            return Object.assign({}, mention, {
                lozenge,
                query,
                id: mention.accountId,
                name: mention.displayName,
                avatarUrl: mention.avatarUrls && mention.avatarUrls['24x24']
            });
        });
        return Object.assign({}, { mentions: mentions, query: result.query || query });
    }
}

const mentionProvider = new JiraMentionResource({});

export function makeProvider(jira) {
    return new Promise(function (resolve) {
        mentionProvider.jira = jira;
        resolve(mentionProvider);
    });
}