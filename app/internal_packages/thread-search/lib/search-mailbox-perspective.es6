import {
  Folder,
  ChangeLabelsTask,
  ChangeFolderTask,
  AccountStore,
  CategoryStore,
  TaskFactory,
  MailboxPerspective,
} from 'mailspring-exports';
import SearchQuerySubscription from './search-query-subscription';

class SearchMailboxPerspective extends MailboxPerspective {
  constructor(sourcePerspective, searchQuery) {
    super(sourcePerspective.accountIds);
    if (typeof searchQuery !== 'string') {
      throw new Error('SearchMailboxPerspective: Expected a `string` search query');
    }

    this.searchQuery = searchQuery;
    if (sourcePerspective instanceof SearchMailboxPerspective) {
      this.sourcePerspective = sourcePerspective.sourcePerspective;
    } else {
      this.sourcePerspective = sourcePerspective;
    }

    this.name = `Searching All`;
  }

  emptyMessage() {
    return 'No search results available';
  }

  isEqual(other) {
    return super.isEqual(other) && other.searchQuery === this.searchQuery;
  }

  threads() {
    return new SearchQuerySubscription(this.searchQuery, this.accountIds);
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }

  tasksForRemovingItems(threads) {
    return TaskFactory.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
      const account = AccountStore.accountForId(accountId);
      if (!account) {
        return [];
      }
      const dest = account.preferredRemovalDestination();

      if (dest.isFolder()) {
        return new ChangeFolderTask({
          threads: accountThreads,
          source: 'Dragged out of list',
          folder: dest,
        });
      }
      if (dest.role === 'all') {
        // if you're searching and archive something, it really just removes the inbox label
        return new ChangeLabelsTask({
          threads: accountThreads,
          source: 'Dragged out of list',
          labelsToRemove: [CategoryStore.getInboxCategory(accountId)],
        });
      }
      AppEnv.reportError(
        new Error('Unexpected destination returned from preferredRemovalDestination()'),
        { errorData: { dest, account: account.id } },
        { grabLogs: true }
      );
    });
  }
}

export default SearchMailboxPerspective;