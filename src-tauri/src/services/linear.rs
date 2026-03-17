use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::Deserialize;

const LINEAR_API: &str = "https://api.linear.app/graphql";

pub struct LinearClient {
    client: reqwest::Client,
}

#[derive(Deserialize)]
struct GraphQLResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphQLError>>,
}

#[derive(Deserialize)]
struct GraphQLError {
    message: String,
}

impl LinearClient {
    pub fn new(api_key: &str) -> Result<Self, String> {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(api_key).map_err(|e| e.to_string())?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self { client })
    }

    pub async fn query<T: serde::de::DeserializeOwned>(
        &self,
        query: &str,
    ) -> Result<T, String> {
        let body = serde_json::json!({ "query": query });
        let resp: GraphQLResponse<T> = self
            .client
            .post(LINEAR_API)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        if let Some(errors) = resp.errors {
            let msgs: Vec<String> = errors.into_iter().map(|e| e.message).collect();
            return Err(msgs.join("; "));
        }

        resp.data.ok_or_else(|| "No data in response".to_string())
    }
}
