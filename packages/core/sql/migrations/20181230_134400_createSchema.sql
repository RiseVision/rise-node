BEGIN
--
-- Name: proc_balance_check(); Type: FUNCTION; Schema: public; Owner: rise
--

CREATE FUNCTION public.proc_balance_check() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    IF NEW."balance" < 0 OR NEW."u_balance" < 0 THEN
      -- IF account is not genesisAc
      -- count then raise exception
      IF NOT EXISTS(SELECT * from info where "key" = 'genesisAccount' and "value" = NEW."address") THEN
        -- CHECK IF account is among an exception
        RAISE WARNING 'Account % Running through exceptions', NEW.address;
        IF EXISTS (SELECT * from exceptions where "type" = 'account' AND "key" = NEW."address" AND "remainingCount" > 0) THEN
          UPDATE exceptions SET "remainingCount" = "remainingCount" - 1 where "type" = 'account' AND "key" = NEW."address";
        ELSE
          RAISE EXCEPTION 'Address % cannot go < 0 on balance: % u_balance: %', NEW.address, NEW."balance", NEW."u_balance";
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END;
$$;

--
-- Name: blocks; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE blocks (
    id character varying(20) NOT NULL,
    "rowId" SERIAL NOT NULL,
    version integer NOT NULL,
    "timestamp" integer NOT NULL,
    height integer NOT NULL,
    "previousBlock" character varying(20),
    "numberOfTransactions" integer NOT NULL,
    "totalAmount" bigint NOT NULL,
    "totalFee" bigint NOT NULL,
    reward bigint NOT NULL,
    "payloadLength" integer NOT NULL,
    "payloadHash" bytea NOT NULL,
    "generatorPublicKey" bytea NOT NULL,
    "blockSignature" bytea NOT NULL,
    FOREIGN KEY("previousBlock") REFERENCES "blocks"("id") ON DELETE SET NULL
);


--
-- Name: delegates; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE delegates (
    username character varying(20) NOT NULL,
    "transactionId" character varying(20) NOT NULL
    FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);


--
-- Name: exceptions; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.exceptions (
    type character varying(10) NOT NULL,
    key character varying(255) NOT NULL,
    "remainingCount" integer NOT NULL
);


ALTER TABLE public.exceptions OWNER TO rise;

--
-- Name: forks_stat; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.forks_stat (
    "delegatePublicKey" bytea NOT NULL,
    "blockTimestamp" integer NOT NULL,
    "blockId" character varying(20) NOT NULL,
    "blockHeight" integer NOT NULL,
    "previousBlock" character varying(20) NOT NULL,
    cause integer NOT NULL
);


ALTER TABLE public.forks_stat OWNER TO rise;

--
-- Name: multisignatures; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.multisignatures (
    min integer NOT NULL,
    lifetime integer NOT NULL,
    keysgroup text NOT NULL,
    "transactionId" character varying(20) NOT NULL
);


ALTER TABLE public.multisignatures OWNER TO rise;

--
-- Name: signatures; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.signatures (
    "transactionId" character varying(20) NOT NULL,
    "publicKey" bytea NOT NULL
);


ALTER TABLE public.signatures OWNER TO rise;

--
-- Name: trs; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.trs (
    id character varying(20) NOT NULL,
    "rowId" integer NOT NULL,
    "blockId" character varying(20) NOT NULL,
    type smallint NOT NULL,
    "timestamp" integer NOT NULL,
    "senderPublicKey" bytea NOT NULL,
    "senderId" character varying(22) NOT NULL,
    "recipientId" character varying(22),
    amount bigint NOT NULL,
    fee bigint NOT NULL,
    signature bytea NOT NULL,
    "signSignature" bytea,
    "requesterPublicKey" bytea,
    signatures text,
    height integer NOT NULL,
    CONSTRAINT cnst_amount CHECK ((amount >= 0)),
    CONSTRAINT cnst_fee CHECK ((fee >= 0)),
    CONSTRAINT upperaddresses CHECK (((upper(("recipientId")::text) = ("recipientId")::text) AND (upper(("senderId")::text) = ("senderId")::text)))
);


ALTER TABLE public.trs OWNER TO rise;

--
-- Name: votes; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.votes (
    votes text,
    "transactionId" character varying(20) NOT NULL
);


ALTER TABLE public.votes OWNER TO rise;

--
-- Name: full_blocks_list; Type: VIEW; Schema: public; Owner: rise
--

CREATE VIEW public.full_blocks_list AS
 SELECT b.id AS b_id,
    b.version AS b_version,
    b."timestamp" AS b_timestamp,
    b.height AS b_height,
    b."previousBlock" AS "b_previousBlock",
    b."numberOfTransactions" AS "b_numberOfTransactions",
    b."totalAmount" AS "b_totalAmount",
    b."totalFee" AS "b_totalFee",
    b.reward AS b_reward,
    b."payloadLength" AS "b_payloadLength",
    encode(b."payloadHash", 'hex'::text) AS "b_payloadHash",
    encode(b."generatorPublicKey", 'hex'::text) AS "b_generatorPublicKey",
    encode(b."blockSignature", 'hex'::text) AS "b_blockSignature",
    t.id AS t_id,
    t."rowId" AS "t_rowId",
    t.type AS t_type,
    t."timestamp" AS t_timestamp,
    encode(t."senderPublicKey", 'hex'::text) AS "t_senderPublicKey",
    t."senderId" AS "t_senderId",
    t."recipientId" AS "t_recipientId",
    t.amount AS t_amount,
    t.fee AS t_fee,
    encode(t.signature, 'hex'::text) AS t_signature,
    encode(t."signSignature", 'hex'::text) AS "t_signSignature",
    encode(s."publicKey", 'hex'::text) AS "s_publicKey",
    d.username AS d_username,
    v.votes AS v_votes,
    m.min AS m_min,
    m.lifetime AS m_lifetime,
    m.keysgroup AS m_keysgroup,
    encode(t."requesterPublicKey", 'hex'::text) AS "t_requesterPublicKey",
    t.signatures AS t_signatures
   FROM (((((public.blocks b
     LEFT JOIN public.trs t ON (((t."blockId")::text = (b.id)::text)))
     LEFT JOIN public.delegates d ON (((d."transactionId")::text = (t.id)::text)))
     LEFT JOIN public.votes v ON (((v."transactionId")::text = (t.id)::text)))
     LEFT JOIN public.signatures s ON (((s."transactionId")::text = (t.id)::text)))
     LEFT JOIN public.multisignatures m ON (((m."transactionId")::text = (t.id)::text)));


ALTER TABLE public.full_blocks_list OWNER TO rise;

--
-- Name: info; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.info (
    key character varying(20) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.info OWNER TO rise;

--
-- Name: mem_accounts; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_accounts (
    username character varying(20),
    "isDelegate" smallint DEFAULT 0,
    "u_isDelegate" smallint DEFAULT 0,
    "secondSignature" smallint DEFAULT 0,
    "u_secondSignature" smallint DEFAULT 0,
    u_username character varying(20),
    address character varying(22) NOT NULL,
    "publicKey" bytea,
    "secondPublicKey" bytea,
    balance bigint DEFAULT 0,
    u_balance bigint DEFAULT 0,
    vote bigint DEFAULT 0,
    rate bigint DEFAULT 0,
    delegates text,
    u_delegates text,
    multisignatures text,
    u_multisignatures text,
    multimin bigint DEFAULT 0,
    u_multimin bigint DEFAULT 0,
    multilifetime bigint DEFAULT 0,
    u_multilifetime bigint DEFAULT 0,
    "blockId" character varying(20),
    nameexist smallint DEFAULT 0,
    u_nameexist smallint DEFAULT 0,
    producedblocks integer DEFAULT 0,
    missedblocks integer DEFAULT 0,
    fees bigint DEFAULT 0,
    rewards bigint DEFAULT 0,
    virgin smallint DEFAULT 1
);


ALTER TABLE public.mem_accounts OWNER TO rise;

--
-- Name: mem_accounts2delegates; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_accounts2delegates (
    "accountId" character varying(22) NOT NULL,
    "dependentId" character varying(64) NOT NULL
);


ALTER TABLE public.mem_accounts2delegates OWNER TO rise;

--
-- Name: mem_accounts2multisignatures; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_accounts2multisignatures (
    "accountId" character varying(22) NOT NULL,
    "dependentId" character varying(64) NOT NULL
);


ALTER TABLE public.mem_accounts2multisignatures OWNER TO rise;

--
-- Name: mem_accounts2u_delegates; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_accounts2u_delegates (
    "accountId" character varying(22) NOT NULL,
    "dependentId" character varying(64) NOT NULL
);


ALTER TABLE public.mem_accounts2u_delegates OWNER TO rise;

--
-- Name: mem_accounts2u_multisignatures; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_accounts2u_multisignatures (
    "accountId" character varying(22) NOT NULL,
    "dependentId" character varying(64) NOT NULL
);


ALTER TABLE public.mem_accounts2u_multisignatures OWNER TO rise;

--
-- Name: mem_round; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_round (
    address character varying(22),
    amount bigint,
    delegate character varying(64),
    "blockId" character varying(20),
    round bigint
);


ALTER TABLE public.mem_round OWNER TO rise;

--
-- Name: mem_round_snapshot; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_round_snapshot (
    address character varying(22),
    amount bigint,
    delegate character varying(64),
    "blockId" character varying(20),
    round bigint
);


ALTER TABLE public.mem_round_snapshot OWNER TO rise;

--
-- Name: mem_votes_snapshot; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.mem_votes_snapshot (
    address character varying(22),
    vote bigint
);


ALTER TABLE public.mem_votes_snapshot OWNER TO rise;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.migrations (
    id character varying(22) NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.migrations OWNER TO rise;

--
-- Name: peers; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.peers (
    id integer NOT NULL,
    ip inet NOT NULL,
    port smallint NOT NULL,
    state smallint NOT NULL,
    os character varying(64),
    version character varying(11),
    clock bigint,
    broadhash bytea,
    height integer
);


ALTER TABLE public.peers OWNER TO rise;

--
-- Name: peers_id_seq; Type: SEQUENCE; Schema: public; Owner: rise
--

CREATE SEQUENCE public.peers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.peers_id_seq OWNER TO rise;

--
-- Name: peers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rise
--

ALTER SEQUENCE public.peers_id_seq OWNED BY public.peers.id;


--
-- Name: rounds_fees; Type: TABLE; Schema: public; Owner: rise
--

CREATE TABLE public.rounds_fees (
    height integer NOT NULL,
    "timestamp" integer NOT NULL,
    fees bigint NOT NULL,
    "publicKey" bytea NOT NULL
);


ALTER TABLE public.rounds_fees OWNER TO rise;

--
-- Name: trs_rowId_seq; Type: SEQUENCE; Schema: public; Owner: rise
--

CREATE SEQUENCE public."trs_rowId_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."trs_rowId_seq" OWNER TO rise;

--
-- Name: trs_rowId_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: rise
--

ALTER SEQUENCE public."trs_rowId_seq" OWNED BY public.trs."rowId";


--
-- Name: blocks rowId; Type: DEFAULT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.blocks ALTER COLUMN "rowId" SET DEFAULT nextval('public."blocks_rowId_seq"'::regclass);


--
-- Name: peers id; Type: DEFAULT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.peers ALTER COLUMN id SET DEFAULT nextval('public.peers_id_seq'::regclass);


--
-- Name: trs rowId; Type: DEFAULT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.trs ALTER COLUMN "rowId" SET DEFAULT nextval('public."trs_rowId_seq"'::regclass);


--
-- Name: peers address_unique; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.peers
    ADD CONSTRAINT address_unique UNIQUE (ip, port);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: delegates delegates_unique; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.delegates
    ADD CONSTRAINT delegates_unique UNIQUE (username, "transactionId");


--
-- Name: exceptions exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.exceptions
    ADD CONSTRAINT exceptions_pkey PRIMARY KEY (type, key);


--
-- Name: info info_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.info
    ADD CONSTRAINT info_pkey PRIMARY KEY (key);


--
-- Name: mem_accounts mem_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.mem_accounts
    ADD CONSTRAINT mem_accounts_pkey PRIMARY KEY (address);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: peers peers_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.peers
    ADD CONSTRAINT peers_pkey PRIMARY KEY (id);


--
-- Name: signatures signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_pkey PRIMARY KEY ("transactionId");


--
-- Name: trs trs_pkey; Type: CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.trs
    ADD CONSTRAINT trs_pkey PRIMARY KEY (id);


--
-- Name: blocks_generator_public_key; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX blocks_generator_public_key ON public.blocks USING btree ("generatorPublicKey");


--
-- Name: blocks_height; Type: INDEX; Schema: public; Owner: rise
--

CREATE UNIQUE INDEX blocks_height ON public.blocks USING btree (height);


--
-- Name: blocks_numberOfTransactions; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "blocks_numberOfTransactions" ON public.blocks USING btree ("numberOfTransactions");


--
-- Name: blocks_previousBlock; Type: INDEX; Schema: public; Owner: rise
--

CREATE UNIQUE INDEX "blocks_previousBlock" ON public.blocks USING btree ("previousBlock");


--
-- Name: blocks_reward; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX blocks_reward ON public.blocks USING btree (reward);


--
-- Name: blocks_rounds; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX blocks_rounds ON public.blocks USING btree (((ceil(((height)::double precision / (101)::double precision)))::integer));


--
-- Name: blocks_rowId; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "blocks_rowId" ON public.blocks USING btree ("rowId");


--
-- Name: blocks_timestamp; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX blocks_timestamp ON public.blocks USING btree ("timestamp");


--
-- Name: blocks_totalAmount; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "blocks_totalAmount" ON public.blocks USING btree ("totalAmount");


--
-- Name: blocks_totalFee; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "blocks_totalFee" ON public.blocks USING btree ("totalFee");


--
-- Name: delegates_trs_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX delegates_trs_id ON public.delegates USING btree ("transactionId");


--
-- Name: idx_accounts_address; Type: INDEX; Schema: public; Owner: rise
--

CREATE UNIQUE INDEX idx_accounts_address ON public.mem_accounts USING btree (address);


--
-- Name: idx_trs_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE UNIQUE INDEX idx_trs_id ON public.trs USING btree (id);


--
-- Name: mem_accounts2delegates_accountId; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "mem_accounts2delegates_accountId" ON public.mem_accounts2delegates USING btree ("accountId");


--
-- Name: mem_accounts2multisignatures_accountId; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "mem_accounts2multisignatures_accountId" ON public.mem_accounts2multisignatures USING btree ("accountId");


--
-- Name: mem_accounts2u_delegates_accountId; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "mem_accounts2u_delegates_accountId" ON public.mem_accounts2u_delegates USING btree ("accountId");


--
-- Name: mem_accounts2u_multisignatures_accountId; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "mem_accounts2u_multisignatures_accountId" ON public.mem_accounts2u_multisignatures USING btree ("accountId");


--
-- Name: mem_accounts_balance; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX mem_accounts_balance ON public.mem_accounts USING btree (balance);


--
-- Name: mem_round_address; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX mem_round_address ON public.mem_round USING btree (address);


--
-- Name: mem_round_round; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX mem_round_round ON public.mem_round USING btree (round);


--
-- Name: multisignatures_trs_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX multisignatures_trs_id ON public.multisignatures USING btree ("transactionId");


--
-- Name: peers_broadhash; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX peers_broadhash ON public.peers USING btree (broadhash);


--
-- Name: peers_height; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX peers_height ON public.peers USING btree (height);


--
-- Name: rounds_fees_fees; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX rounds_fees_fees ON public.rounds_fees USING btree (fees);


--
-- Name: rounds_fees_height; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX rounds_fees_height ON public.rounds_fees USING btree (height);


--
-- Name: rounds_fees_public_key; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX rounds_fees_public_key ON public.rounds_fees USING btree ("publicKey");


--
-- Name: rounds_fees_round; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX rounds_fees_round ON public.rounds_fees USING btree (((ceil(((height)::double precision / (101)::double precision)))::integer));


--
-- Name: rounds_fees_timestamp; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX rounds_fees_timestamp ON public.rounds_fees USING btree ("timestamp");


--
-- Name: signatures_trs_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX signatures_trs_id ON public.signatures USING btree ("transactionId");


--
-- Name: trs_block_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_block_id ON public.trs USING btree ("blockId");


--
-- Name: trs_recipient_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_recipient_id ON public.trs USING btree ("recipientId");


--
-- Name: trs_rowId; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "trs_rowId" ON public.trs USING btree ("rowId");


--
-- Name: trs_senderPublicKey; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX "trs_senderPublicKey" ON public.trs USING btree ("senderPublicKey");


--
-- Name: trs_sender_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_sender_id ON public.trs USING btree ("senderId");


--
-- Name: trs_timestamp; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_timestamp ON public.trs USING btree ("timestamp");


--
-- Name: trs_type; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_type ON public.trs USING btree (type);


--
-- Name: trs_upper_recipient_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_upper_recipient_id ON public.trs USING btree (upper(("recipientId")::text));


--
-- Name: trs_upper_sender_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX trs_upper_sender_id ON public.trs USING btree (upper(("senderId")::text));


--
-- Name: votes_trs_id; Type: INDEX; Schema: public; Owner: rise
--

CREATE INDEX votes_trs_id ON public.votes USING btree ("transactionId");


--
-- Name: blocks rounds_fees_delete; Type: TRIGGER; Schema: public; Owner: rise
--

CREATE TRIGGER rounds_fees_delete AFTER DELETE ON public.blocks FOR EACH ROW WHEN (((old.height % 101) = 0)) EXECUTE PROCEDURE public.round_fees_delete();


--
-- Name: blocks rounds_fees_insert; Type: TRIGGER; Schema: public; Owner: rise
--

CREATE TRIGGER rounds_fees_insert AFTER INSERT ON public.blocks FOR EACH ROW WHEN (((new.height % 101) = 0)) EXECUTE PROCEDURE public.round_fees_insert();


--
-- Name: mem_accounts trg_memaccounts_update; Type: TRIGGER; Schema: public; Owner: rise
--

CREATE TRIGGER trg_memaccounts_update BEFORE UPDATE OF balance, u_balance ON public.mem_accounts FOR EACH ROW EXECUTE PROCEDURE public.proc_balance_check();


--
-- Name: blocks blocks_previousBlock_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT "blocks_previousBlock_fkey" FOREIGN KEY ("previousBlock") REFERENCES public.blocks(id) ON DELETE SET NULL;


--
-- Name: delegates delegates_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.delegates
    ADD CONSTRAINT "delegates_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.trs(id) ON DELETE CASCADE;


--
-- Name: mem_accounts2delegates mem_accounts2delegates_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.mem_accounts2delegates
    ADD CONSTRAINT "mem_accounts2delegates_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.mem_accounts(address) ON DELETE CASCADE;


--
-- Name: mem_accounts2multisignatures mem_accounts2multisignatures_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.mem_accounts2multisignatures
    ADD CONSTRAINT "mem_accounts2multisignatures_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.mem_accounts(address) ON DELETE CASCADE;


--
-- Name: mem_accounts2u_delegates mem_accounts2u_delegates_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.mem_accounts2u_delegates
    ADD CONSTRAINT "mem_accounts2u_delegates_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.mem_accounts(address) ON DELETE CASCADE;


--
-- Name: mem_accounts2u_multisignatures mem_accounts2u_multisignatures_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.mem_accounts2u_multisignatures
    ADD CONSTRAINT "mem_accounts2u_multisignatures_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.mem_accounts(address) ON DELETE CASCADE;


--
-- Name: multisignatures multisignatures_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.multisignatures
    ADD CONSTRAINT "multisignatures_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.trs(id) ON DELETE CASCADE;


--
-- Name: signatures signatures_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT "signatures_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.trs(id) ON DELETE CASCADE;


--
-- Name: trs trs_blockId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.trs
    ADD CONSTRAINT "trs_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: votes votes_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rise
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT "votes_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.trs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

