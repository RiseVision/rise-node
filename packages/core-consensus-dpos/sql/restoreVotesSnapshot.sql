UPDATE mem_accounts m SET vote = b.vote, "votesWeight" = b."votesWeight" FROM mem_votes_snapshot b WHERE m.address = b.address
