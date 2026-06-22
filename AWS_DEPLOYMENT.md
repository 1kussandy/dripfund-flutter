# AWS Production Deployment Guide (ECS Express Mode / Fargate)

This guide details the step-by-step instructions to deploy your full-stack Control Tower and Scan Terminal application to **Amazon Web Services (AWS)** using **Amazon ECS** with **AWS Fargate**. It is specifically designed to handle a continuous load of **30+ managers using it 24/7** and up to **200 flow associates (AAs) scanning during shift changes**, offering incredibly fast performance, high-availability, automatic database persistence, and no server management overhead.

---

## 🏗️ The Production-Ready AWS Architecture

To guarantee speed, ease of use, and continuous availability with zero maintenance, your stack will run on:

1. **Database Backend**: **AWS RDS PostgreSQL** (`db.t4g.micro` or `db.t4g.small` on AWS Graviton3). Provides stable SQL storage for your shifts, associates, paths, and scanned placements.
2. **Container Host**: **Amazon ECS with AWS Fargate (Express Mode)**. Runs your production `Dockerfile` in serverless containment. This auto-scales seamlessly during rush hour scans and keeps costs low when idle.
3. **Container Registry**: **Amazon ECR (Elastic Container Registry)**. Securely stores your private application image.

---

## 🎯 Step 1: Set Up Your Database (AWS RDS PostgreSQL)

1. **Log in to the AWS Management Console**.
2. Search for **RDS** in the top search bar and click on it.
3. Click **Create database** (orange button).
4. Choose **Standard create** and select PostgreSQL.
5. Under **Templates**, select **Free Tier** (or **Dev/Test** for automated backups).
6. **Instance settings**:
   * **DB instance identifier**: `sast-control-tower`
   * **Master username**: `postgres`
   * **Master password**: *Create a strong password (write it down!)*
7. **Instance configuration**:
   * Choose **db.t4g.micro** (1 vCPU, 1 GB RAM, free-tier eligible) or **db.t4g.small** (2 vCPU, 2 GB RAM). These ARM64 Graviton instances are faster and 20% cheaper than traditional Intel ones.
8. **Connectivity**:
   * **Public access**: Select **Yes** (to allow initial connection from outer container hosts).
   * Leave default VPC and default Subnets.
9. **Additional configuration** (scroll to the bottom):
   * Expand **Additional configuration** and under **Initial database name**, type `control_tower`.
10. Click **Create database**. This takes about 3-5 minutes. Once it changes to **Available**, copy the **Endpoint** (e.g. `sast-control-tower.xxxxxx.us-east-1.rds.amazonaws.com`).

---

## 🛡️ Step 2: Configure Database Security Group

1. Click on your active RDS Database `sast-control-tower`.
2. Under the **Connectivity & security** tab, look for **Security groups**. Click the active group link (e.g. `rds-launch-wizard-...`).
3. Scroll to the bottom and click **Edit inbound rules**.
4. Add a new rule:
   * **Type**: `PostgreSQL` (Port `5432`).
   * **Source**: `Anywhere-IPv4` (`0.0.0.0/0`) or select custom IP range of your containers.
5. Click **Save rules**.

---

## 📦 Step 3: Publish Your Container Image to Amazon ECR

We need to push the container image to Amazon.

1. Search for **ECR (Elastic Container Registry)** in the AWS console.
2. Click **Create repository**.
   * Select **Private**.
   * **Repository name**: `sast-control-tower`.
   * Click **Create repository**.
3. Click into your new repository and click the **View push commands** button in the top right. 
4. Run these exact command lines in your local terminal to log in, build, and push your multi-stage production Docker image:
   ```bash
   # 1. Authenticate your local Docker client to ECR
   
   # 2. Build your optimized Docker Image
   docker build -t sast-control-tower .

   # 3. Tag your image for Amazon ECR
   docker tag sast-control-tower:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/sast-control-tower:latest

   # 4. Push your image to AWS
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/sast-control-tower:latest
   ```

---

## 🚀 Step 4: Launch Your Application in Amazon ECS Fargate Express Mode

Amazon ECS with **Fargate** represents the official, scalable, modern replacement for new container hosting. Utilizing the standard AWS console cluster wizard:

1. Search for **Elastic Container Service (ECS)** in the AWS Console.
2. Go to **Clusters** and click **Create cluster**.
   * **Cluster name**: `sast-controltower-cluster`.
   * **Infrastructure**: Select **AWS Fargate** (Serverless).
   * Click **Create**.
3. Go to **Task Definitions** (left sidebar) and click **Create new task definition with JSON** (or use the visual builder):
   * **Task definition family**: `sast-task`.
   * **Infrastructure requirements**: Select **AWS Fargate**.
   * **Operating system/Architecture**: Linux/ARM64 or Linux/X86_64 depending on your build machine.
   * **Task size**: Choose **0.5 vCPU and 1 GB RAM** (plenty for 200 concurrent scans).
   * **Container details**:
     * **Name**: `sast-container`
     * **Image URI**: Enter your ECR Image URI (e.g. `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/sast-control-tower:latest`)
     * **Port mappings**: Container port `3000` (TCP).
     * Scroll down to **Environment variables** and map your production database secrets:
       * `DB_USER` = `postgres`
       * `DB_HOST` = *(Paste your RDS endpoint)*
       * `DB_PASSWORD` = *(Your RDS master password)*
       * `DB_DATABASE` = `control_tower`
       * `NODE_ENV` = `production`
       * `PORT` = `3000`
   * Click **Create**.
4. Go back to your **sast-controltower-cluster** details and under the **Services** tab, click **Deploy**:
   * **Application type**: Service.
   * **Task definition Family**: `sast-task`.
   * **Service name**: `sast-task-service-vf032nvu`.
   * **Desired tasks**: `1` (or `2` for absolute redundancy!).
   * **Networking**:
     * **VPC**: Choose your default VPC.
     * **Security group**: Create a new security group allowing Inbound Traffic on **Port 3000** from anywhere (`0.0.0.0/0`).
     * **Public IP**: Make sure it is set to **Turned on**.
5. Click **Deploy**. Fargate will provision, launch, and run your container.
6. Once the task status becomes **Running**, click on the Task, find the list of network interfaces, and copy the **Public IP**. Open `http://YOUR_PUBLIC_IP:3000` in your web browser. Everything is ready for high-concurrency scanning!

---

## 🔒 Step 5: Configure Your Custom Domain & SSL (HTTPS)

Deploying with a public IP on HTTP (`http://YOUR_PUBLIC_IP:3000`) is perfect for testing, but for production, you need an **official custom domain** (e.g., `sast-control.com` or `scan.company.com`) and **secure HTTPS link** (browsers block barcode cameras and stateful operations on insecure HTTP links).

Here are the **two best methods** to configure your custom domain with HTTPS on AWS ECS Fargate:

---

### 🌟 Option A: The Cloudflare Proxy Method (Free SSL, Easiest & 100% Free)
If you want **free SSL**, **DDoS protection**, and a **custom domain** without paying AWS the extra $18–$22/month for a Load Balancer, Cloudflare is the best option.

#### 1. Point Your Domain to Cloudflare
1. Create a free account at [Cloudflare](https://www.cloudflare.com).
2. Click **Add a Site** and input your custom domain (e.g., `company.com`).
3. Cloudflare will give you two custom Nameservers. Replace your domain registrar's current Nameservers (at GoDaddy, Namecheap, Google Domains, etc.) with the Cloudflare Nameservers.

#### 2. Create DNS Records Pointing to Your ECS IP
1. Inside the Cloudflare Dashboard, go to **DNS** -> **Records**.
2. Click **Add Record** for your root domain:
   * **Type**: select `A`
   * **Name**: `@` (represents the root domain `optimusstaffinghub.com`)
   * **IPv4 Address**: `3.83.83.81` *(Your active ECS Fargate Task Public IP)*
   * **Proxy Status**: Keep **Proxied** (with the active orange cloud icon 🟠)
   * Click **Save**.
3. Create a second DNS Record for `www` (so users who type `www.optimusstaffinghub.com` still reach your app):
   * Click **Add Record**:
   * **Type**: select `CNAME`
   * **Name**: `www`
   * **Target**: `optimusstaffinghub.com`
   * **Proxy Status**: Keep **Proxied** (with the active orange cloud icon 🟠)
   * Click **Save**.

#### 3. Map Port 3000 to Standard HTTP/HTTPS (Cloudflare Origin Rules)
Because your Fargate task runs on **Port 3000** rather than Port 80 or 443, standard web requests (which look for Port 80/443) will fail unless you map them. We can do this **100% free** using a Cloudflare **Origin Rule**:
1. In the left-hand sidebar of your Cloudflare Dashboard, expand **Rules** and select **Origin Rules**.
2. Click the blue **Create rule** button.
3. Fill in the parameters:
   * **Rule name**: `Map to Fargate Port 3000`
   * **If incoming requests match...**: Select **Custom filter expression**
   * **Field**: Choose `Hostname`
   * **Operator**: Choose `equals`
   * **Value**: Type `optimusstaffinghub.com`
   * Click **Or** to add the www domain:
     * **Field**: `Hostname`
     * **Operator**: `equals`
     * **Value**: `www.optimusstaffinghub.com`
   * Under **Then... (Set destination settings)**, scroll down to **Origin Port**:
     * Select **Override**
     * Enter **`3000`** in the port text box.
4. Click **Deploy** in the bottom-right corner.

#### 4. Enable HTTPS Decryption
1. In Cloudflare, go to **SSL/TLS** (left menu) -> **Overview**.
2. Set the configuration to **Flexible**. 
   * *This tells Cloudflare to secure the connection with an SSL certificate between the user and Cloudflare (so they see the premium padlock 🔒 in their browser), while Cloudflare communicates over Port 3000 HTTP to your Fargate task.*
3. Toggle **Always Use HTTPS** to **On** under the Edge Certificates tab.
4. Open your custom domain in your browser! It will instantly load your control panel securely over standard HTTPS.

*(Note: If you restart your ECS Task and the Public IP changes, you will need to update the A record in Cloudflare with the new IP).*

---

### 🛡️ Option B: The AWS Application Load Balancer Method (AWS Native, Real-Time Auto-Scale)
This is the enterprise golden standard. The AWS Load Balancer manages all incoming requests, automates SSL certificate renewals, and maps to ECS tasks even as they start/stop or scale up dynamically.
*Estimated cost: ~$18–$20 per month for the ALB.*

#### 1. Request a Free Certificate in AWS Certificate Manager (ACM)
1. Go to the AWS Console and search for **Certificate Manager (ACM)**.
2. Click **Request Certificate** -> Select **Request a public certificate**.
3. Under **Domain names**, enter your custom domain name (e.g., `scan.company.com` or `*.company.com`).
4. Keep **DNS validation** selected, and click **Request**.
5. Click on the requested certificate ID. Down under **Domains**, click **Create records in Route 53** (if using Route 53) or copy the CNAME Name and Value to add to your external domain registrar (GoDaddy/Cloudflare) to complete validation. *Within 5 minutes, status will turn to **Issued**.*

#### 2. Create Your Application Load Balancer (ALB)
1. Search for **EC2** in AWS console, and select **Load Balancers** on the left menu.
2. Click **Create Load Balancer** -> Choose **Application Load Balancer (ALB)**.
3. **Basic Configuration**:
   * **Name**: `sast-alb`.
   * **Scheme**: Internet-facing.
   * **IP address type**: IPv4.
4. **Network mapping**:
   * Choose the same VPC as your ECS Fargate cluster.
   * Select at least two subnets (usually choose all default public subnets).
5. **Security Groups**:
   * Create or select a security group that allows inbound traffic on **Port 80 (HTTP)** and **Port 443 (HTTPS)** from `0.0.0.0/0`.
6. **Listeners and routing**:
   * Add a listener on **HTTPS: 443**.
   * Under **Default action**, click **Create target group** (this opens a new tab):
     * Choose **IP addresses** as target type.
     * **Target group name**: `sast-tg`.
     * **Protocol**: `HTTP`, **Port**: `3000` (since your node container runs on 3000).
     * **VPC**: Select your default VPC.
     * Click **Next**, and then click **Create target group** (do not register any IPs manually; ECS will register them automatically).
   * Go back to the Load Balancer setup tab, refresh the target group list, and select your new `sast-tg` target group.
   * Scroll down to **Secure listener settings** -> **Default SSL/TLS certificate** -> choose **From ACM** -> Select your ACM certificate.
7. Click **Create load balancer** (it will provision in 2 minutes, and output an DNS Name like `sast-alb-12345.us-east-1.elb.amazonaws.com`).

#### 3. Update Your ECS Service to Use the Load Balancer
1. Go to your **Amazon ECS Cluster** -> click **sast-task-service-vf032nvu** -> click **Update** (top right).
2. Scroll to the **Load balancing** section:
   * **Load balancer type**: Select **Application Load Balancer**.
   * **Load balancer**: Select `sast-alb`.
   * Under **Container to load balance**: Choose your active container on Port 3000, and map it to your target group `sast-tg`.
3. Click **Update** to redeploy Fargate.

#### 4. Map Your Domain in DNS
1. Go to your Domain Registrar (Route 53, Cloudflare, GoDaddy, etc.).
2. Add a **CNAME** record:
   * **Name**: `scan` (for `scan.company.com`) or `@` 
   * **Value**: *Paste the DNS Name of your AWS Load Balancer* (e.g. `sast-alb-12345.us-east-1.elb.amazonaws.com`).
3. Save the DNS record. Open your custom domain on `https://yourdomain.com`—your system is now fully live with AWS Enterprise SSL!

---

## 🛠️ Step 6: Step-by-Step Troubleshooting (If it is not working yet)

If you followed the Cloudflare steps and the site is not loading or showing an error, please check these **4 exact checkpoints** in order. One of these is 100% the reason:

### 🔍 Checkpoint 1: Can you reach your app directly by its IP?
In your web browser, go to: `http://3.83.83.81:3000`
* **If it DOES NOT load**: The issue is inside AWS.
  * *Fix*: Go to **Amazon ECS Console** -> **Clusters** -> your cluster -> **Services** -> select your service and click **Update** (or view its active Task). Look at the **Security Group**. You must add an **Inbound Rule** that allows **Port 3000** from **Anywhere-IPv4** (`0.0.0.0/0`). If this security rule is missing, AWS blocks all traffic on port 3000!
* **If it DOES load**: The issue is inside your Cloudflare or Domain Registrar settings. Proceed to Checkpoint 2.

### 🔍 Checkpoint 2: Is Cloudflare fully active for your domain?
In your Cloudflare Dashboard, go to your site name (`optimusstaffinghub.com`) and click **Overview** in the left sidebar.
* **If it says "Great news! Cloudflare is now protecting your site"**: Cloudflare is active. Proceed to Checkpoint 3.
* **If it says "Pending Nameserver Update"**:
  * *Fix*: Your Domain Registrar (GoDaddy, Namecheap, Google Domains, etc.) has not yet updated to Cloudflare nameservers, or it is still propagating. Go to your registrar account, make sure they are set to your specific Cloudflare nameservers, and wait a few minutes. (You can click **"Check nameservers"** in Cloudflare to speed it up).

### 🔍 Checkpoint 3: Is your SSL/TLS encryption mode set to "Flexible"?
In the Cloudflare Dashboard:
1. Click **SSL/TLS** in the left sidebar.
2. In the Overview panel, verify that your encryption mode is set to **Flexible** (the second option).
* **Why this is critical**: If it is set to *Full* or *Full (strict)*, Cloudflare will try to request the site from your Fargate server over secure HTTPS. But your Fargate server is only serving normal HTTP on port 3000. This mismatch causes a **525 SSL Handshake Failed** error. Setting it to **Flexible** guarantees Cloudflare encrypts the communication to the user while keeping the back-end communication simple.

### 🔍 Checkpoint 4: Checking your Origin Rule for Typos
In the Cloudflare Dashboard:
1. Click **Rules** -> **Origin Rules** in the left sidebar.
2. Under your `Map to Fargate Port 3000` rule, click **Edit**.
3. Check the spelling of `optimusstaffinghub.com` and `www.optimusstaffinghub.com` exactly. If there is a typo (e.g. `optimustaffinghub.com` with one 's' instead of two), Cloudflare won't forward the traffic to Port 3000, and it will fail.
4. Click **Deploy** to save any corrections.

