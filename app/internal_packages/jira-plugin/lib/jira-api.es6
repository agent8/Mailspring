import JiraApiBase from 'jira-client';

export default class JiraApi extends JiraApiBase {
    downloadThumbnail = attachment => {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: "/thumbnail/".concat(attachment.id, "/").concat(encodeURI(encodeURI(attachment.filename.replace(/ /g, '')))),
            intermediatePath: '/secure'
        }), {
            json: false,
            encoding: null
        }));
    }
    downloadAttachment = attachment => {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: "/attachment/".concat(attachment.id, "/").concat(encodeURI(encodeURI(attachment.filename.replace(/ /g, '')))),
            intermediatePath: '/secure'
        }), {
            json: false,
            encoding: null
        }));
    }
    findComments = (jiraId, expand, startAt, maxResults) => {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: "/issue/".concat(jiraId).concat("/comment"),
            query: {
                expand: expand || 'renderedBody',
                startAt: startAt || 0,
                maxResults: maxResults || 50,
            }
        })));
    }
    searchAssignableUsers(data) {
        var issueKey = data.issueKey,
            username = data.username,
            startAt = data.startAt,
            maxResults = data.maxResults,
            includeActive = data.includeActive,
            includeInactive = data.includeInactive;
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: '/user/assignable/search',
            query: {
                issueKey: issueKey,
                username: username,
                startAt: startAt || 0,
                maxResults: maxResults || 50,
                includeActive: includeActive || true,
                includeInactive: includeInactive || false
            }
        }), {
            followAllRedirects: true
        }));
    }
    updateAssignee(issueKey, accountId) {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: "/issue/".concat(issueKey, "/assignee")
        }), {
            method: 'PUT',
            followAllRedirects: true,
            body: {
                accountId
            }
        }));
    }
}